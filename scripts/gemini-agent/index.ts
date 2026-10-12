/**
 * Sentinel 2.0 — Phase 7: Live Gemini External Agent Demo CLI
 *
 * Entry point for:
 * npm run demo:gemini
 * DEMO_MODE=true npm run demo:gemini
 */

import { GeminiAgentRunner } from './gemini-agent.js';
import { SentinelClient } from './sentinel-client.js';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  orange: '\x1b[38;5;208m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

function formatSentinelDecision(decision: string): string {
  switch (decision) {
    case 'ALLOW':
      return `${colors.green}${colors.bright}ALLOW${colors.reset}`;
    case 'MONITOR':
      return `${colors.cyan}${colors.bright}MONITOR${colors.reset}`;
    case 'WARN':
      return `${colors.yellow}${colors.bright}WARN${colors.reset}`;
    case 'CONFIRM':
      return `${colors.orange}${colors.bright}CONFIRM${colors.reset}`;
    case 'BLOCK':
      return `${colors.red}${colors.bright}BLOCK${colors.reset}`;
    default:
      return decision;
  }
}

async function main() {
  const envDemo = process.env.DEMO_MODE === 'true';
  const envGemini = process.env.GEMINI_MODE === 'true';
  const rawKey = process.env.GEMINI_API_KEY;
  const hasKey = Boolean(rawKey && rawKey.trim().length > 0 && rawKey !== 'your_gemini_api_key_here');

  // Decide if running live or demo
  const isLive = !envDemo && (envGemini || hasKey) && hasKey;
  const modeLabel = isLive ? 'LIVE GEMINI AGENT DEMO' : 'GEMINI AGENT DEMO';
  const modeTag = isLive ? 'LIVE GEMINI MODE' : 'DEMO MODE';

  console.log(`
${colors.bright}${colors.cyan}SENTINEL 2.0${colors.reset}
${colors.bright}${modeLabel}${colors.reset}
${colors.dim}Runtime Mode: ${modeTag}${colors.reset}
`);

  // Verify Sentinel API is running
  const sentinelUrl = process.env.SENTINEL_URL || 'http://localhost:4000/api/v1';
  const client = new SentinelClient({ baseUrl: sentinelUrl });
  const isHealthy = await client.checkHealth();

  if (!isHealthy) {
    console.error(
      `${colors.red}[ERROR] Sentinel 2.0 Backend is not reachable at ${sentinelUrl}.${colors.reset}\n` +
      `Please ensure the backend is running on port 4000 (npm run dev:backend).\n`
    );
    process.exit(1);
  }

  const runner = new GeminiAgentRunner({
    sentinelUrl,
    demoMode: !isLive,
    geminiMode: isLive,
    apiKey: hasKey ? rawKey : undefined,
    onStep: (stepIndex, tool, description, decision, humanDecision) => {
      // Step presentation formatted to exact specification
      const descText =
        stepIndex === 1
          ? 'READ project documentation'
          : stepIndex === 2
          ? 'READ source code'
          : stepIndex === 3
          ? 'WRITE research report'
          : stepIndex === 4
          ? 'READ finance data'
          : stepIndex === 5
          ? 'ACCESS admin configuration'
          : stepIndex === 6
          ? 'DELETE production resource'
          : description;

      console.log(`[${stepIndex}] Gemini → ${descText}`);
      console.log(`Sentinel → ${formatSentinelDecision(decision)}`);

      if (decision === 'CONFIRM') {
        console.log(`\n${colors.orange}${colors.bright}HUMAN REVIEW REQUIRED${colors.reset}`);
        if (humanDecision) {
          console.log(`${colors.dim}Human operator decision: ${humanDecision}${colors.reset}\n`);
        } else {
          console.log('');
        }
      } else {
        console.log('');
      }
    }
  });

  try {
    console.log('Agent registered');
    console.log('Session started\n');

    const summary = await runner.run();

    console.log(`${colors.bright}${colors.green}SESSION COMPLETE${colors.reset}\n`);

    // Structured Telemetry Summary
    console.log(`${colors.dim}------------------------------------------------------------`);
    console.log(`Structured Telemetry Summary:`);
    console.log(`Agent ID      : ${summary.agentId}`);
    console.log(`Session ID    : ${summary.sessionId}`);
    console.log(`Execution Mode: ${summary.mode}`);
    console.log(`Model         : ${summary.modelName}`);
    console.log(`Total Steps   : ${summary.totalSteps}`);
    console.log(`Final Decision: ${summary.finalDecision}`);
    console.log(`Halted Status : ${summary.executionHalted ? 'YES (Halted by Sentinel)' : 'NO'}`);
    console.log(`------------------------------------------------------------${colors.reset}\n`);
  } catch (err: unknown) {
    console.error(`\n${colors.red}[ERROR] Demo failed:${colors.reset}`, (err as Error).message);
    process.exit(1);
  }
}

main();
