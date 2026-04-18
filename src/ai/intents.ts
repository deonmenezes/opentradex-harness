/**
 * AI → Agent/Harness intent router.
 *
 * Parses natural-language commands and maps them to concrete actions on the
 * agent, risk module, and exchange harness. Returns null when no intent is
 * matched so the caller can fall through to a conversational AI reply.
 *
 * Deterministic by design — regex beats LLM tool-calling here because every
 * provider (openai, anthropic, ollama, gemini-cli, claude-cli, opencode-cli)
 * speaks a different tool-calling dialect and many don't speak it at all.
 */

import { getAgent, AgentConfig } from '../agent/index.js';
import { getRiskState, panicFlatten, getOpenPositions } from '../risk.js';
import type { OpenTradex } from '../index.js';

export interface IntentContext {
  harness: OpenTradex;
  broadcast: (event: string, data: unknown) => void;
}

export interface IntentResult {
  action: string;
  reply: string;
  data?: unknown;
}

type Handler = (
  match: RegExpMatchArray,
  command: string,
  ctx: IntentContext
) => Promise<IntentResult> | IntentResult;

interface Intent {
  name: string;
  pattern: RegExp;
  handler: Handler;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

const INTENTS: Intent[] = [
  // START / AUTONOMOUS TRADING
  {
    name: 'agent.start',
    pattern: /\b(start|begin|go|enable|activate|run|kick.?off)\b[^.]{0,40}?\b(trad(e|ing)?|auto(?:-?loop)?|agent|bot)\b/i,
    handler: async (_m, command, ctx) => {
      const agent = getAgent();
      // Default to auto-loop when the user says "start trading" — that's the
      // whole point. Explicit "no loop" / "once" / "single cycle" disables it.
      const wantsLoop = !/\b(once|single|one.?shot|no.?loop|manual)\b/i.test(command);
      const cfg: Partial<AgentConfig> = { autoLoop: wantsLoop };
      agent.updateConfig(cfg);
      await agent.start();
      ctx.broadcast('agent', { event: 'started', status: agent.getStatus() });
      return {
        action: 'agent.start',
        reply: `Autonomous trading started${wantsLoop ? ' (auto-loop on)' : ' (single cycle)'}. Mode: ${agent.getConfig().mode}. Watch the dashboard for live cycles and fills.`,
        data: { status: agent.getStatus() },
      };
    },
  },

  // STOP AGENT
  {
    name: 'agent.stop',
    pattern: /\b(stop|halt|pause|kill|disable|shut.?down)\b[^.]{0,40}?\b(trad(e|ing)?|auto(?:-?loop)?|agent|bot)\b/i,
    handler: (_m, _c, ctx) => {
      const agent = getAgent();
      agent.stop();
      ctx.broadcast('agent', { event: 'stopped', status: agent.getStatus() });
      return {
        action: 'agent.stop',
        reply: `Autonomous trading stopped. Cycles this session: ${agent.getStatus().cycles}.`,
        data: { status: agent.getStatus() },
      };
    },
  },

  // AUTOLOOP TOGGLE (without start/stop)
  {
    name: 'agent.autoloop',
    pattern: /\bauto.?loop\b.*\b(on|off|enable|disable|true|false)\b/i,
    handler: (_m, command, ctx) => {
      const enabled = /\b(on|enable|true)\b/i.test(command);
      const agent = getAgent();
      agent.setAutoLoop(enabled);
      ctx.broadcast('agent', { event: 'autoloop', enabled, status: agent.getStatus() });
      return {
        action: 'agent.autoloop',
        reply: `Auto-loop ${enabled ? 'enabled' : 'disabled'}.`,
        data: { enabled, status: agent.getStatus() },
      };
    },
  },

  // PANIC / FLATTEN
  {
    name: 'risk.panic',
    pattern: /\b(panic|flatten|close\s+all|emergency|dump\s+everything|liquidate)\b/i,
    handler: (_m, _c, ctx) => {
      const agent = getAgent();
      if (agent.getStatus().running) agent.stop();
      const result = panicFlatten();
      ctx.broadcast('panic', result);
      ctx.broadcast('agent', { event: 'stopped', status: agent.getStatus() });
      return {
        action: 'risk.panic',
        reply: `PANIC executed. Flattened ${result.flattened.length} position(s). Realized P&L: $${result.totalPnL.toFixed(2)}. Agent stopped.`,
        data: result,
      };
    },
  },

  // SCAN
  {
    name: 'scan.markets',
    pattern: /\b(scan|find|search|show\s+me)\b[^.]{0,40}\b(market|opportunit|trade|setup|signal)/i,
    handler: async (_m, _c, ctx) => {
      const markets = await ctx.harness.scanAll(10);
      ctx.broadcast('scan', { markets });
      const top = markets.slice(0, 5);
      const lines = top.map(
        (m) => `- ${m.exchange}: ${m.symbol} @ $${Number(m.price).toFixed(2)}`
      );
      return {
        action: 'scan.markets',
        reply: `Scanned ${markets.length} markets. Top 5:\n${lines.join('\n')}`,
        data: markets,
      };
    },
  },

  // RISK / PNL
  {
    name: 'risk.status',
    pattern: /\b(risk|p[&n]l|pnl|daily(?:\s+loss)?|exposure|drawdown)\b/i,
    handler: () => {
      const state = getRiskState();
      return {
        action: 'risk.status',
        reply:
          `Risk State:\n` +
          `- Daily P&L: $${state.dailyPnL.toFixed(2)}\n` +
          `- Open Positions: ${state.openPositions.length}\n` +
          `- Trades Today: ${state.dailyTrades}\n` +
          `- Win Rate: ${state.dailyTrades > 0 ? fmtPct((state.dailyWins / state.dailyTrades) * 100) : 'n/a'}`,
        data: state,
      };
    },
  },

  // POSITIONS
  {
    name: 'positions.list',
    pattern: /\b(positions?|holdings?|what\s+am\s+i\s+(in|holding))\b/i,
    handler: () => {
      const positions = getOpenPositions();
      if (positions.length === 0) {
        return {
          action: 'positions.list',
          reply: 'No open positions.',
          data: [],
        };
      }
      const lines = positions.map(
        (p) =>
          `- ${p.symbol} (${p.exchange}) ${p.side} ${p.size} @ $${p.avgPrice.toFixed(2)} · now $${p.currentPrice.toFixed(2)} · P&L ${fmtPct(p.pnlPercent)}`
      );
      return {
        action: 'positions.list',
        reply: `${positions.length} open position(s):\n${lines.join('\n')}`,
        data: positions,
      };
    },
  },

  // MANUAL BUY — "buy 10 AAPL" / "long 5 BTC"
  {
    name: 'trade.buy',
    pattern: /\b(buy|long|go\s+long)\s+(?:(\d+(?:\.\d+)?)\s+)?([A-Z][A-Z0-9/-]{1,15})\b/i,
    handler: async (match, _c, ctx) => {
      const [, , qtyRaw, symbol] = match;
      const quantity = qtyRaw ? parseFloat(qtyRaw) : 1;
      const agent = getAgent();
      try {
        const result = await agent.manualTrade({
          symbol: symbol.toUpperCase(),
          side: 'buy',
          quantity,
          type: 'market',
        });
        ctx.broadcast('trade', {
          symbol: symbol.toUpperCase(),
          side: 'buy',
          quantity,
          price: result?.price ?? 0,
        });
        return {
          action: 'trade.buy',
          reply: `Bought ${quantity} ${symbol.toUpperCase()} at market.`,
          data: result,
        };
      } catch (err) {
        return {
          action: 'trade.buy.rejected',
          reply: `Buy rejected: ${(err as Error).message}`,
        };
      }
    },
  },

  // MANUAL SELL — "sell 10 AAPL" / "close AAPL"
  {
    name: 'trade.sell',
    pattern: /\b(sell|short|close)\s+(?:(\d+(?:\.\d+)?)\s+)?([A-Z][A-Z0-9/-]{1,15})\b/i,
    handler: async (match, _c, ctx) => {
      const [, , qtyRaw, symbol] = match;
      const quantity = qtyRaw ? parseFloat(qtyRaw) : 1;
      const agent = getAgent();
      try {
        const result = await agent.manualTrade({
          symbol: symbol.toUpperCase(),
          side: 'sell',
          quantity,
          type: 'market',
        });
        ctx.broadcast('trade', {
          symbol: symbol.toUpperCase(),
          side: 'sell',
          quantity,
          price: result?.price ?? 0,
        });
        return {
          action: 'trade.sell',
          reply: `Sold ${quantity} ${symbol.toUpperCase()} at market.`,
          data: result,
        };
      } catch (err) {
        return {
          action: 'trade.sell.rejected',
          reply: `Sell rejected: ${(err as Error).message}`,
        };
      }
    },
  },

  // AGENT STATUS
  {
    name: 'agent.status',
    pattern: /\b(agent\s+status|is\s+the\s+(agent|bot)\s+running|are\s+you\s+trading|what.?s\s+the\s+agent)\b/i,
    handler: () => {
      const agent = getAgent();
      const s = agent.getStatus();
      return {
        action: 'agent.status',
        reply: `Agent is ${s.running ? 'RUNNING' : 'stopped'}. Cycles: ${s.cycles}. Open positions: ${s.openPositions}. Day P&L: $${s.dayPnL.toFixed(2)}. Errors: ${s.errors}.`,
        data: s,
      };
    },
  },
];

/**
 * Try each intent in order. Returns the first match's result, or null.
 */
export async function routeIntent(
  command: string,
  ctx: IntentContext
): Promise<IntentResult | null> {
  for (const intent of INTENTS) {
    const match = command.match(intent.pattern);
    if (match) {
      try {
        return await intent.handler(match, command, ctx);
      } catch (err) {
        return {
          action: `${intent.name}.error`,
          reply: `Action "${intent.name}" failed: ${(err as Error).message}`,
        };
      }
    }
  }
  return null;
}
