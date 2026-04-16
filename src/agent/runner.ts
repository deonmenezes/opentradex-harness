#!/usr/bin/env node
/**
 * OpenTradex AI Agent Runner
 * Standalone process for 24/7 market monitoring and automated trading
 */

import { AIAgent, AgentConfig } from './index.js';

// Parse command line arguments
function parseArgs(): Partial<AgentConfig> {
  const args = process.argv.slice(2);
  const config: Partial<AgentConfig> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--mode':
        config.mode = args[++i] as 'paper-only' | 'paper-default' | 'live-allowed';
        break;
      case '--interval':
        config.scanInterval = parseInt(args[++i], 10) * 1000; // Convert seconds to ms
        break;
      case '--auto-loop':
        config.autoLoop = true;
        break;
      case '--max-cycles':
        config.maxCycles = parseInt(args[++i], 10);
        break;
      case '--max-position':
        if (!config.riskLimits) config.riskLimits = { maxPositionSize: 1000, maxDailyLoss: 500, maxDrawdown: 0.1 };
        config.riskLimits.maxPositionSize = parseFloat(args[++i]);
        break;
      case '--max-daily-loss':
        if (!config.riskLimits) config.riskLimits = { maxPositionSize: 1000, maxDailyLoss: 500, maxDrawdown: 0.1 };
        config.riskLimits.maxDailyLoss = parseFloat(args[++i]);
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
OpenTradex AI Agent Runner

Usage: npx ts-node src/agent/runner.ts [options]

Options:
  --mode <mode>           Trading mode: paper-only, paper-default, live-allowed (default: paper-only)
  --interval <seconds>    Scan interval in seconds (default: 60)
  --auto-loop             Enable automatic loop mode
  --max-cycles <n>        Maximum cycles before stopping (0 = unlimited)
  --max-position <$>      Maximum position size in dollars (default: 1000)
  --max-daily-loss <$>    Maximum daily loss before stopping (default: 500)
  --help                  Show this help message

Examples:
  # Run in paper mode with 30-second scans
  npx ts-node src/agent/runner.ts --mode paper-only --interval 30 --auto-loop

  # Run for 100 cycles then stop
  npx ts-node src/agent/runner.ts --auto-loop --max-cycles 100

  # Conservative settings
  npx ts-node src/agent/runner.ts --max-position 500 --max-daily-loss 100 --auto-loop
`);
}

async function main(): Promise<void> {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           OpenTradex AI Agent - 24/7 Runner               ║
║                                                           ║
║   Autonomous market monitoring and trading system         ║
╚═══════════════════════════════════════════════════════════╝
`);

  const config = parseArgs();
  const agent = new AIAgent(config);

  // Setup event handlers
  agent.on('started', () => {
    console.log('\n✅ Agent started successfully\n');
  });

  agent.on('stopped', () => {
    console.log('\n⏹️  Agent stopped\n');
  });

  agent.on('cycle-start', (cycle: number) => {
    console.log(`\n🔄 Starting cycle #${cycle}`);
  });

  agent.on('cycle-complete', (data: any) => {
    console.log(`✅ Cycle #${data.cycle} complete:`, {
      opportunities: data.opportunities,
      executed: data.executed,
      positions: data.status.openPositions,
      dayPnL: `$${data.status.dayPnL.toFixed(2)}`,
    });
  });

  agent.on('trade', (trade: any) => {
    const emoji = trade.side === 'buy' ? '📈' : '📉';
    console.log(`${emoji} Trade: ${trade.side.toUpperCase()} ${trade.quantity} ${trade.symbol} @ $${trade.price.toFixed(2)}`);
  });

  agent.on('risk-alert', (alert: any) => {
    console.log(`⚠️  Risk Alert: ${alert.type} - ${JSON.stringify(alert)}`);
  });

  agent.on('error', (error: Error) => {
    console.error('❌ Error:', error.message);
  });

  agent.on('emergency-stop', () => {
    console.log('\n🚨 EMERGENCY STOP EXECUTED\n');
  });

  // Handle process signals
  process.on('SIGINT', () => {
    console.log('\n\nReceived SIGINT, shutting down gracefully...');
    agent.stop();
    setTimeout(() => process.exit(0), 1000);
  });

  process.on('SIGTERM', () => {
    console.log('\n\nReceived SIGTERM, shutting down gracefully...');
    agent.stop();
    setTimeout(() => process.exit(0), 1000);
  });

  // Display config
  console.log('Configuration:', agent.getConfig());
  console.log('\nPress Ctrl+C to stop\n');

  // Start the agent
  await agent.start();

  // Keep process alive
  if (!config.autoLoop) {
    console.log('\nAgent running in manual mode. Use API to trigger scans.\n');
    // In manual mode, just keep alive
    await new Promise(() => {});
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
