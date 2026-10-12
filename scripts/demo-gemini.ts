/**
 * Sentinel 2.0 — Live External AI Agent CLI Demonstration
 *
 * Supports:
 * - Live Google Gemini model (when GEMINI_API_KEY is present)
 * - Deterministic Mock Provider (when --mock is passed or GEMINI_API_KEY is absent)
 * - All 5 canonical scenarios: GEMINI_NORMAL, GEMINI_SCOPE_CREEP, GEMINI_SENSITIVE_ACCESS,
 *   GEMINI_PRIVILEGE_ESCALATION, GEMINI_DESTRUCTIVE_ATTEMPT
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const BASE_URL = process.env.SENTINEL_URL || 'http://localhost:4000/api/v1';

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
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

function formatDecision(decision: string): string {
  switch (decision) {
    case 'ALLOW':
      return `${colors.green}${colors.bright}[ALLOW]${colors.reset}`;
    case 'MONITOR':
      return `${colors.cyan}${colors.bright}[MONITOR]${colors.reset}`;
    case 'WARN':
      return `${colors.yellow}${colors.bright}[WARN]${colors.reset}`;
    case 'CONFIRM':
      return `${colors.orange}${colors.bright}[CONFIRM REQUIRED]${colors.reset}`;
    case 'BLOCK':
      return `${colors.red}${colors.bright}[BLOCKED BY SENTINEL]${colors.reset}`;
    default:
      return `[${decision}]`;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message || body.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  return body;
}

async function main() {
  const args = process.argv.slice(2);
  const isForceMock = args.includes('--mock') || process.env.DEMO_MODE === 'true';
  const rawKey = process.env.GEMINI_API_KEY;
  const hasKey = Boolean(rawKey && rawKey.trim().length > 0 && rawKey !== 'your_gemini_api_key_here');
  const scenarioArg = args.find((a) => a.startsWith('--scenario='));
  const scenarioId = scenarioArg ? scenarioArg.split('=')[1] : (process.env.SCENARIO || 'GEMINI_SCOPE_CREEP');

  const isLive = !isForceMock && hasKey;
  const configuredModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const providerLabel = isLive ? `Google Gemini (${configuredModel})` : 'Deterministic Mock Provider';
  const modeTag = isLive ? 'LIVE GEMINI MODE' : 'MOCK PROVIDER DEMO MODE';

  console.log(`
${colors.bright}${colors.cyan}============================================================
 SENTINEL 2.0 — EXTERNAL AI AGENT CONTROL PLANE
============================================================${colors.reset}
Gateway Target : ${BASE_URL}
Provider       : ${providerLabel}
Execution Mode : ${modeTag}
Active Scenario: ${scenarioId}
`);

  // Verify Sentinel API is running
  try {
    const rootUrl = BASE_URL.replace(/\/v1$/, '');
    const health = await fetch(`${rootUrl}/health`);
    if (!health.ok) throw new Error('Health check failed');
  } catch {
    console.error(
      `${colors.red}[ERROR] Sentinel 2.0 Backend is not running at ${BASE_URL}.${colors.reset}\n` +
      `Please start the backend: npm run dev:backend\n`
    );
    process.exit(1);
  }

  // 1. Fetch Provider Status from Sentinel Gateway
  console.log(`${colors.bright}Step 1: Checking Provider Gateway Status...${colors.reset}`);
  const statusRes = await request('/live-agent/status');
  console.log(`  Configured : ${statusRes.isConfigured ? colors.green + 'YES' : colors.yellow + 'NO (Using Mock Provider)'}${colors.reset}`);
  console.log(`  Model      : ${statusRes.modelName}`);
  console.log(`  Status Note: ${statusRes.statusText}\n`);

  // 2. Start Governed Session
  console.log(`${colors.bright}Step 2: Starting Governed External Agent Session...${colors.reset}`);
  const startRes = await request('/live-agent/start', {
    method: 'POST',
    body: JSON.stringify({
      scenarioId,
      taskPrompt: 'Investigate project documentation, audit codebase, and analyze cloud metrics',
      forceProvider: isLive ? 'gemini' : 'mock'
    })
  });

  const session = startRes.session;
  const agent = startRes.agent;
  console.log(`  Agent ID   : ${colors.green}${agent.id}${colors.reset}`);
  console.log(`  Agent Name : ${agent.name}`);
  console.log(`  Session ID : ${colors.green}${session.id}${colors.reset}`);
  console.log(`  Started At : ${session.startedAt}\n`);

  // 3. Execute Controlled Step Loop
  console.log(`${colors.bright}Step 3: Streaming Model Actions Through Sentinel Runtime Gate...${colors.reset}\n`);

  let stepCount = 0;
  const maxSteps = 6;
  let isHalted = false;

  while (stepCount < maxSteps && !isHalted) {
    stepCount++;
    console.log(`${colors.bright}--- Step ${stepCount} ---${colors.reset}`);

    const stepRes = await request('/live-agent/step', {
      method: 'POST',
      body: JSON.stringify({ sessionId: session.id })
    });

    const step = stepRes.data || stepRes;
    const action = step.proposedAction;

    console.log(`  Model Proposed : ${colors.cyan}${action.action} ${action.resource}${colors.reset} (Scope: ${action.scope}, Sensitivity: ${action.sensitivity})`);
    console.log(`  Model Reason   : "${action.reason}"`);
    console.log(`  Sentinel Gate  : ${formatDecision(step.decision)}`);
    console.log(`  Cumulative Risk: ${step.risk}/100 | Deviation: ${step.trajectoryDeviation}% | Window: ${step.interventionWindow}`);

    if (step.decision === 'CONFIRM') {
      console.log(`\n  ${colors.orange}${colors.bright}⚠️  HUMAN REVIEW REQUIRED${colors.reset}`);
      console.log(`  Simple Mode: "${step.simpleNarration.what}"`);
      console.log(`  Why: ${step.simpleNarration.why}`);
      console.log(`  Risk Assessment: ${step.simpleNarration.risk}`);

      // Simulate operator human decision
      console.log(`  ${colors.green}Operator Decision: ALLOW_ONCE (Verified one-time research exception)${colors.reset}\n`);
      await request('/live-agent/decision', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: session.id,
          decision: 'ALLOW_ONCE',
          reviewerId: 'sec-ops-lead',
          reason: 'Verified one-time research exception'
        })
      });
    } else if (step.decision === 'BLOCK') {
      console.log(`\n  ${colors.red}${colors.bright}⛔ BLOCKED BY SENTINEL SECURITY ENGINE${colors.reset}`);
      console.log(`  Policy Reasons: ${step.decisionReasons.join(' | ')}`);
      console.log(`  Simple Mode: "${step.simpleNarration.what}"`);
      console.log(`  Recommendation: ${step.simpleNarration.actionRecommendation}\n`);
      isHalted = true;
      break;
    } else {
      console.log('');
    }

    // Brief cadence pause for streaming readability
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log(`
${colors.bright}${colors.green}============================================================
 DEMO COMPLETE: Sentinel Controlled External AI Agent!
============================================================${colors.reset}
Session Status : ${isHalted ? colors.red + 'TERMINATED (BLOCKED)' : colors.green + 'COMPLETED (GOVERNED)'}${colors.reset}
Session ID     : ${session.id}
Total Steps    : ${stepCount}
Provider Used  : ${providerLabel}
`);
}

main().catch((err) => {
  console.error(`\n${colors.red}[ERROR] Demo execution failed:${colors.reset}`, err.message);
  process.exit(1);
});
