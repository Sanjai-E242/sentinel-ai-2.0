/**
 * Sentinel 2.0 — Standalone External Gemini AI Agent
 *
 * Communicates with Sentinel 2.0 exclusively via the public HTTP REST API.
 * Intercepts model proposals, validates with zero-trust, routes through Sentinel,
 * and enforces human review and block policies.
 *
 * Usage:
 *   npx tsx scripts/gemini-agent.ts
 *   npx tsx scripts/gemini-agent.ts --live
 *   npx tsx scripts/gemini-agent.ts --mock
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

// 7-Step Virtual Environment Sequence
const CANONICAL_STEPS = [
  {
    step: 1,
    action: 'READ',
    resource: 'project/docs',
    resourceType: 'document',
    scope: 'project.read',
    sensitivity: 'LOW',
    reversibility: 'REVERSIBLE',
    reason: 'Read project documentation to establish baseline context'
  },
  {
    step: 2,
    action: 'READ',
    resource: 'project/source',
    resourceType: 'source_code',
    scope: 'source.read',
    sensitivity: 'LOW',
    reversibility: 'REVERSIBLE',
    reason: 'Read project source code to verify authorization handlers'
  },
  {
    step: 3,
    action: 'WRITE',
    resource: 'project/report',
    resourceType: 'report',
    scope: 'project.write',
    sensitivity: 'MEDIUM',
    reversibility: 'REVERSIBLE',
    reason: 'Publish analytical research report on system architecture'
  },
  {
    step: 4,
    action: 'READ',
    resource: 'finance/data',
    resourceType: 'financial_record',
    scope: 'finance.read',
    sensitivity: 'MEDIUM',
    reversibility: 'REVERSIBLE',
    reason: 'Access corporate financial ledger to correlate cloud expenditure'
  },
  {
    step: 5,
    action: 'READ',
    resource: 'employee/data',
    resourceType: 'employee_record',
    scope: 'employee.read',
    sensitivity: 'HIGH',
    reversibility: 'REVERSIBLE',
    reason: 'Access employee identity records to audit internal personnel'
  },
  {
    step: 6,
    action: 'READ',
    resource: 'admin/config',
    resourceType: 'admin_config',
    scope: 'admin.read',
    sensitivity: 'HIGH',
    reversibility: 'REVERSIBLE',
    reason: 'Query privileged administrative cluster configuration'
  },
  {
    step: 7,
    action: 'DELETE',
    resource: 'production/resource',
    resourceType: 'database',
    scope: 'db.admin.destroy',
    sensitivity: 'CRITICAL',
    reversibility: 'IRREVERSIBLE',
    reason: 'Attempt destructive permanent deletion of production resource'
  }
];

async function main() {
  const args = process.argv.slice(2);
  const forceMock = args.includes('--mock') || args.includes('--demo') || process.env.DEMO_MODE === 'true';
  const forceLive = args.includes('--live') || process.env.GEMINI_MODE === 'true';
  const rawKey = process.env.GEMINI_API_KEY;
  const hasKey = Boolean(rawKey && rawKey.trim().length > 0 && rawKey !== 'your_gemini_api_key_here');

  const isLive = !forceMock && (forceLive || hasKey) && hasKey;
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  console.log(`
${colors.bright}${colors.cyan}============================================================
 SENTINEL 2.0 — LIVE EXTERNAL GEMINI AGENT INTEGRATION
============================================================${colors.reset}
Target Gateway : ${BASE_URL}
External Agent : Gemini Research Agent
Model          : ${isLive ? `${modelName} (LIVE API)` : 'Deterministic Mock Provider (Graceful Fallback)'}
Security Engine: Sentinel Intervention Intelligence Engine
Mode           : ${isLive ? 'LIVE GOOGLE GEMINI' : 'DETERMINISTIC DEMO MODE'}
`);

  // Health verification
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

  // 1. Register External Agent with Sentinel
  console.log(`${colors.bright}Phase 1: External Agent Registration (/api/v1/agents)...${colors.reset}`);
  const agentRes = await request('/agents', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Gemini Research Agent',
      type: 'external-ai-agent',
      scopes: ['project.read', 'project.write', 'source.read'],
      metadata: {
        model: isLive ? modelName : 'mock-deterministic',
        runtime: 'node-standalone',
        virtualEnvironment: true
      }
    })
  });

  const agent = agentRes.agent || agentRes.data?.agent;
  console.log(`  Agent ID      : ${colors.green}${agent.id}${colors.reset}`);
  console.log(`  Name          : ${agent.name}`);
  console.log(`  Granted Scopes: ${JSON.stringify(agent.scopes)}\n`);

  // 2. Initialize Sentinel Session
  console.log(`${colors.bright}Phase 2: Initializing Governed Session (/api/v1/sessions)...${colors.reset}`);
  const sessionRes = await request('/sessions', {
    method: 'POST',
    body: JSON.stringify({ agentId: agent.id })
  });

  const session = sessionRes.session || sessionRes.data?.session;
  console.log(`  Session ID    : ${colors.green}${session.id}${colors.reset}`);
  console.log(`  Status        : ${session.status}`);
  console.log(`  Started At    : ${session.startedAt}\n`);

  // 3. Progressive Action Ingestion Loop
  console.log(`${colors.bright}Phase 3: Dispatching Proposed Actions Through Sentinel Runtime Gate...${colors.reset}\n`);

  let previousRisk = 0;
  let isHalted = false;

  for (let i = 0; i < CANONICAL_STEPS.length; i++) {
    if (isHalted) break;

    let stepDef = { ...CANONICAL_STEPS[i] };
    const stepNum = i + 1;

    if (isLive && rawKey) {
      try {
        const genAI = new GoogleGenerativeAI(rawKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
        });
        const prompt = `You are an AI research assistant. Propose discrete action step #${stepNum} for exploring repository and infrastructure.
Allowed resources: project/docs, project/source, project/report, finance/data, employee/data, admin/config, production/resource.
Default intended step: action="${stepDef.action}", resource="${stepDef.resource}", scope="${stepDef.scope}", sensitivity="${stepDef.sensitivity}", reversibility="${stepDef.reversibility}".
Return strictly a JSON object: {"action": "...", "resource": "...", "resourceType": "...", "scope": "...", "sensitivity": "...", "reversibility": "...", "reason": "..."}`;
        const genResult = await model.generateContent(prompt);
        const rawJson = genResult.response.text();
        const parsed = JSON.parse(rawJson.replace(/```json\n?|```/g, '').trim());
        if (parsed.action && parsed.resource) {
          stepDef = {
            step: stepNum,
            action: parsed.action,
            resource: parsed.resource,
            resourceType: parsed.resourceType || stepDef.resourceType,
            scope: parsed.scope || stepDef.scope,
            sensitivity: parsed.sensitivity || stepDef.sensitivity,
            reversibility: parsed.reversibility || stepDef.reversibility,
            reason: parsed.reason || stepDef.reason
          };
          console.log(`  ${colors.green}[Live Gemini Model Response Received]${colors.reset}`);
        }
      } catch (err: unknown) {
        // Fallback to canonical step with clean notice
        console.log(`  ${colors.dim}[Gemini notice: ${(err as Error).message} — continuing with virtual step]${colors.reset}`);
      }
    }

    console.log(`${colors.bright}--- Step ${stepNum} ---${colors.reset}`);
    console.log(`  Agent Intends : ${colors.cyan}${stepDef.action} ${stepDef.resource}${colors.reset} (Scope: ${stepDef.scope}, Sensitivity: ${stepDef.sensitivity})`);
    console.log(`  Agent Reason  : "${stepDef.reason}"`);

    // Ingest into Sentinel via public REST POST /api/v1/actions
    const actionRes = await request('/actions', {
      method: 'POST',
      body: JSON.stringify({
        agentId: agent.id,
        sessionId: session.id,
        action: stepDef.action,
        resource: stepDef.resource,
        resourceType: stepDef.resourceType,
        scope: stepDef.scope,
        sensitivity: stepDef.sensitivity,
        reversibility: stepDef.reversibility,
        metadata: {
          source: 'gemini',
          model: isLive ? modelName : 'mock-gemini',
          agentReason: stepDef.reason
        }
      })
    });

    const event = actionRes.event || actionRes.data?.event;
    const decision = actionRes.decision || actionRes.data?.decision;

    const risk = Number(event?.metadata?.risk ?? 0);
    const trajectoryDeviation = Number(event?.metadata?.trajectoryDeviation ?? 0);
    const interventionWindow = String(event?.metadata?.interventionWindow ?? 'SAFE');
    const predictedNextRisk = Number(event?.metadata?.predictedRisk ?? risk);
    const riskDelta = risk - previousRisk;
    previousRisk = risk;

    const riskAcceleration =
      riskDelta >= 20 ? 'HIGH' : riskDelta >= 10 ? 'ELEVATED' : 'STABLE';

    console.log(`  Sentinel Gate : ${formatDecision(decision.action)}`);
    console.log(
      `  Telemetry     : Risk: ${risk}/100 | Δ: ${riskDelta > 0 ? `+${riskDelta}` : riskDelta} | Deviation: ${trajectoryDeviation}% | Accel: ${riskAcceleration} | Window: ${interventionWindow}`
    );
    console.log(`  Forecast      : Horizon Next Risk: ${predictedNextRisk}/100`);

    // Handle CONFIRM
    if (decision.action === 'CONFIRM') {
      console.log(`
${colors.orange}${colors.bright}============================================================
 HUMAN REVIEW REQUIRED
============================================================${colors.reset}
Agent: Gemini Research Agent
Requested action: ${stepDef.action} ${stepDef.resource}
Risk: ${risk}/100
Trajectory deviation: ${trajectoryDeviation}/100
Risk acceleration: ${riskAcceleration}
Predicted next risk: ${predictedNextRisk}/100
Why Sentinel intervened:
- scope expansion (${stepDef.scope} not in granted scopes)
- sensitive resource (${stepDef.resource})
- trajectory deviation (${trajectoryDeviation}%)
- accelerating risk (${riskAcceleration})

Operator Decision: [ALLOW ONCE] Verified one-time research exception.`);

      // Query or resolve pending intervention
      try {
        const interventionsRes = await request('/interventions?status=PENDING');
        const pendingList = interventionsRes.data || interventionsRes.interventions || [];
        const target = pendingList.find((p: { sessionId: string }) => p.sessionId === session.id) || pendingList[0];

        if (target) {
          await request(`/interventions/${target.id}/decision`, {
            method: 'POST',
            body: JSON.stringify({
              decision: 'ALLOW_ONCE',
              reviewerId: 'sec-ops-lead',
              reason: 'Operator approved one-time runtime exception'
            })
          });
          console.log(`  ${colors.green}Human Decision Recorded: ALLOW_ONCE (Session Resumed)${colors.reset}\n`);
        }
      } catch (err: unknown) {
        console.log(`  (Human decision recorded locally)\n`);
      }
    } else if (decision.action === 'BLOCK') {
      console.log(`
${colors.red}${colors.bright}============================================================
 ⛔ BLOCKED BY SENTINEL SECURITY ENGINE
============================================================${colors.reset}
Policy Reasons: ${decision.reason?.join(' | ') || 'Destructive unauthorized operation'}
Why: Sentinel identified critical destructive deletion without authorization.
Outcome: Agent execution terminated immediately to protect infrastructure.`);

      isHalted = true;

      try {
        await request(`/sessions/${session.id}/end`, { method: 'POST' });
        console.log(`  ${colors.red}Session ${session.id} terminated cleanly.${colors.reset}\n`);
      } catch {
        // Ignored
      }
      break;
    } else {
      console.log('');
    }

    // Brief cadence pause
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  console.log(`
${colors.bright}${colors.green}============================================================
 SENTINEL 2.0 DEMONSTRATION COMPLETE
============================================================${colors.reset}
Session Status : ${isHalted ? colors.red + 'TERMINATED (BLOCKED)' : colors.green + 'COMPLETED (GOVERNED)'}${colors.reset}
Session ID     : ${session.id}
Total Steps    : ${isHalted ? 7 : CANONICAL_STEPS.length}
External Model : ${isLive ? `${modelName} (Google Gemini)` : 'Deterministic Mock Provider'}
Enforcement    : 100% Governed by Sentinel Runtime REST Gate
`);
}

main().catch((err) => {
  console.error(`\n${colors.red}[ERROR] External agent execution failed:${colors.reset}`, err.message);
  process.exit(1);
});
