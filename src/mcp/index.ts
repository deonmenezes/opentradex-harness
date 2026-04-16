/**
 * OpenTradex MCP Server
 * Exposes trading tools for Claude Code CLI integration
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { loadConfig } from '../config.js';
import { getRiskState, checkRisk } from '../risk.js';

const PORT = parseInt(process.env.OPENTRADEX_PORT || '3210');
const GATEWAY_URL = `http://localhost:${PORT}`;

// MCP Protocol types
interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

// Tool definitions
const tools: MCPTool[] = [
  {
    name: 'opentradex_scan',
    description: 'Scan markets across all enabled exchanges. Returns top opportunities with prices and volume.',
    inputSchema: {
      type: 'object',
      properties: {
        exchange: {
          type: 'string',
          description: 'Filter by exchange (kalshi, polymarket, alpaca, crypto). Leave empty for all.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 10)',
        },
      },
    },
  },
  {
    name: 'opentradex_quote',
    description: 'Get real-time quote for a specific symbol on an exchange.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'The symbol/market to quote (e.g., FED-SEP-CUT, AAPL, BTCUSD)',
        },
        exchange: {
          type: 'string',
          description: 'The exchange (kalshi, polymarket, alpaca, crypto)',
        },
      },
      required: ['symbol', 'exchange'],
    },
  },
  {
    name: 'opentradex_portfolio',
    description: 'View current portfolio state including open positions, P&L, and available capital.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'opentradex_risk',
    description: 'Check current risk state including daily P&L, position limits, and trading restrictions.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'opentradex_command',
    description: 'Send a natural language command to the AI trading assistant.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The command or question (e.g., "analyze SPY", "suggest a trade", "explain my risk")',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'opentradex_trade',
    description: 'Execute a paper trade. Use with caution - this will create a real position in paper mode.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['buy', 'sell'],
          description: 'Trade direction',
        },
        symbol: {
          type: 'string',
          description: 'The symbol to trade',
        },
        exchange: {
          type: 'string',
          description: 'The exchange',
        },
        size: {
          type: 'number',
          description: 'Position size in contracts or shares',
        },
        price: {
          type: 'number',
          description: 'Limit price (optional for market orders)',
        },
      },
      required: ['action', 'symbol', 'exchange', 'size'],
    },
  },
  {
    name: 'opentradex_status',
    description: 'Get the current harness status including mode, connected exchanges, and AI availability.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Tool execution
async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'opentradex_scan': {
        const params = new URLSearchParams();
        if (args.exchange) params.set('exchange', String(args.exchange));
        if (args.limit) params.set('limit', String(args.limit));
        const res = await fetch(`${GATEWAY_URL}/api/scan?${params}`);
        return res.json();
      }

      case 'opentradex_quote': {
        const params = new URLSearchParams({
          symbol: String(args.symbol),
          exchange: String(args.exchange),
        });
        const res = await fetch(`${GATEWAY_URL}/api/quote?${params}`);
        return res.json();
      }

      case 'opentradex_portfolio': {
        const res = await fetch(`${GATEWAY_URL}/api/agent/status`);
        const data = await res.json() as { status?: unknown };
        const risk = getRiskState();
        return {
          status: data.status,
          positions: risk.openPositions,
          dailyPnL: risk.dailyPnL,
          tradestoday: risk.dailyTrades,
        };
      }

      case 'opentradex_risk': {
        const res = await fetch(`${GATEWAY_URL}/api/risk`);
        return res.json();
      }

      case 'opentradex_command': {
        const res = await fetch(`${GATEWAY_URL}/api/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: args.command }),
        });
        return res.json();
      }

      case 'opentradex_trade': {
        // Risk check first
        const riskCheck = checkRisk({
          symbol: String(args.symbol),
          exchange: String(args.exchange) as 'kalshi' | 'polymarket' | 'alpaca' | 'crypto' | 'tradingview',
          side: args.action === 'buy' ? 'long' : 'short',
          size: Number(args.size),
          price: Number(args.price) || 0,
        });

        if (!riskCheck.allowed) {
          return {
            error: 'Trade blocked by risk engine',
            reason: riskCheck.reason,
          };
        }

        // In paper mode, simulate the trade
        const config = loadConfig();
        if (config?.tradingMode === 'paper-only' || config?.tradingMode === 'paper-default') {
          return {
            status: 'executed',
            mode: 'paper',
            trade: {
              action: args.action,
              symbol: args.symbol,
              exchange: args.exchange,
              size: args.size,
              price: args.price || 'market',
              timestamp: new Date().toISOString(),
            },
            message: 'Paper trade executed successfully',
          };
        }

        return {
          error: 'Live trading not implemented via MCP',
          suggestion: 'Use the dashboard for live trades',
        };
      }

      case 'opentradex_status': {
        const [healthRes, aiRes] = await Promise.all([
          fetch(`${GATEWAY_URL}/api/health`),
          fetch(`${GATEWAY_URL}/api/ai/status`),
        ]);
        const health = await healthRes.json() as Record<string, unknown>;
        const ai = await aiRes.json() as { available?: boolean; config?: { model?: string } };
        return {
          ...health,
          ai: {
            available: ai.available,
            model: ai.config?.model,
          },
        };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return {
      error: 'Failed to execute tool',
      message: error instanceof Error ? error.message : 'Unknown error',
      suggestion: 'Make sure the OpenTradex gateway is running: npx opentradex run',
    };
  }
}

// MCP JSON-RPC handler
async function handleMCPRequest(req: MCPRequest): Promise<MCPResponse> {
  const { id, method, params } = req;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'opentradex',
            version: '0.1.0',
          },
        },
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools },
      };

    case 'tools/call': {
      const { name, arguments: args } = params as { name: string; arguments: Record<string, unknown> };
      const result = await executeTool(name, args || {});
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        },
      };
    }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

// Start MCP server (stdio mode for Claude Code)
export async function startMCPServer(): Promise<void> {
  // For stdio transport (default for Claude Code)
  if (process.argv.includes('--stdio') || !process.argv.includes('--http')) {
    console.error('[MCP] Starting OpenTradex MCP server (stdio mode)');
    console.error(`[MCP] Gateway URL: ${GATEWAY_URL}`);

    let buffer = '';

    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', async (chunk) => {
      buffer += chunk;

      // Process complete JSON-RPC messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const request = JSON.parse(line) as MCPRequest;
          const response = await handleMCPRequest(request);
          process.stdout.write(JSON.stringify(response) + '\n');
        } catch (error) {
          const errorResponse: MCPResponse = {
            jsonrpc: '2.0',
            id: 0,
            error: { code: -32700, message: 'Parse error' },
          };
          process.stdout.write(JSON.stringify(errorResponse) + '\n');
        }
      }
    });

    process.stdin.on('end', () => {
      console.error('[MCP] Connection closed');
      process.exit(0);
    });

    return;
  }

  // HTTP transport (alternative)
  const httpPort = parseInt(process.env.MCP_PORT || '3211');

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end('Method not allowed');
      return;
    }

    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const request = JSON.parse(body) as MCPRequest;
        const response = await handleMCPRequest(request);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
  });

  server.listen(httpPort, () => {
    console.log(`[MCP] OpenTradex MCP server running on port ${httpPort}`);
    console.log(`[MCP] Gateway URL: ${GATEWAY_URL}`);
  });
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  startMCPServer();
}
