/**
 * Sentinel 2.0 — External AI Agent Simulation Script
 *
 * This script simulates an external Gemini / AI Agent interacting with protected resources.
 * It communicates ONLY through the public Sentinel 2.0 REST API over HTTP.
 * No internal backend modules or repositories are imported.
 */

const BASE_URL = process.env.SENTINEL_URL || 'http://localhost:4000/api/v1';

// ANSI color formatting for terminal display
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
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
      return `${colors.red}${colors.bright}[BLOCKED]${colors.reset}`;
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
    throw new Error(body.error?.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  return body;
}

async function runDemo() {
  console.log(`
${colors.bright}${colors.cyan}============================================================
 SENTINEL 2.0 — EXTERNAL AI AGENT INTEGRATION DEMO
============================================================${colors.reset}
Target Gateway : ${BASE_URL}
Simulation     : Autonomous Research Agent Lifecycle
`);

  try {
    // 1. Register Agent
    console.log(`${colors.bright}Step 1: Registering External AI Agent...${colors.reset}`);
    const agentPayload = {
      name: 'Gemini Research Assistant',
      type: 'external-ai-agent',
      scopes: ['project.read', 'project.write', 'source.read']
    };

    const registerRes = await request('/agents', {
      method: 'POST',
      body: JSON.stringify(agentPayload)
    });

    const agent = registerRes.agent || registerRes.data?.agent;
    console.log(`  Agent ID     : ${colors.green}${agent.id}${colors.reset}`);
    console.log(`  Agent Name   : ${agent.name}`);
    console.log(`  Status       : ${agent.status}`);
    console.log(`  Granted Scopes: ${JSON.stringify(agent.scopes)}\n`);

    // 2. Create Session
    console.log(`${colors.bright}Step 2: Initializing Runtime Session...${colors.reset}`);
    const sessionRes = await request('/sessions', {
      method: 'POST',
      body: JSON.stringify({ agentId: agent.id })
    });

    const session = sessionRes.session || sessionRes.data?.session;
    console.log(`  Session ID   : ${colors.green}${session.id}${colors.reset}`);
    console.log(`  Status       : ${session.status}`);
    console.log(`  Started At   : ${session.startedAt}\n`);

    // 3. Dispatch Series of Actions
    console.log(`${colors.bright}Step 3: Dispatching Agent Tool Actions to Sentinel Runtime...${colors.reset}\n`);

    const actionsToSimulate = [
      {
        description: 'Read internal documentation (authorized scope, low sensitivity, reversible)',
        payload: {
          agentId: agent.id,
          sessionId: session.id,
          action: 'READ',
          resource: 'project-documents',
          resourceType: 'document',
          scope: 'project.read',
          sensitivity: 'low',
          reversibility: 'reversible'
        }
      },
      {
        description: 'Read codebase repositories (authorized scope, low sensitivity, reversible)',
        payload: {
          agentId: agent.id,
          sessionId: session.id,
          action: 'READ',
          resource: 'git-repo/src/kernel',
          resourceType: 'source_code',
          scope: 'source.read',
          sensitivity: 'low',
          reversibility: 'reversible'
        }
      },
      {
        description: 'Write analytical synthesis report (authorized scope, medium sensitivity)',
        payload: {
          agentId: agent.id,
          sessionId: session.id,
          action: 'WRITE',
          resource: 'project-report-v1',
          resourceType: 'report',
          scope: 'project.write',
          sensitivity: 'medium',
          reversibility: 'reversible'
        }
      },
      {
        description: 'Access executive financial records (UNAUTHORIZED scope, low sensitivity, reversible)',
        payload: {
          agentId: agent.id,
          sessionId: session.id,
          action: 'READ',
          resource: 'corporate-ledger/2026-q3',
          resourceType: 'financial_record',
          scope: 'finance.read', // Out of scope
          sensitivity: 'low',
          reversibility: 'reversible'
        }
      },
      {
        description: 'Destroy production database tables (UNAUTHORIZED scope, critical, irreversible)',
        payload: {
          agentId: agent.id,
          sessionId: session.id,
          action: 'DELETE',
          resource: 'prod-cluster/primary-db',
          resourceType: 'database',
          scope: 'db.admin.destroy', // Out of scope
          sensitivity: 'critical',
          reversibility: 'irreversible'
        }
      }
    ];

    for (let i = 0; i < actionsToSimulate.length; i++) {
      const item = actionsToSimulate[i];
      console.log(`${colors.bright}[Action ${i + 1}/${actionsToSimulate.length}] ${item.description}${colors.reset}`);
      console.log(`  Payload: ${item.payload.action} ${item.payload.resource} (scope: ${item.payload.scope})`);

      const actionRes = await request('/actions', {
        method: 'POST',
        body: JSON.stringify(item.payload)
      });

      const event = actionRes.event || actionRes.data?.event;
      const decision = actionRes.decision || actionRes.data?.decision;

      console.log(`  Event ID     : ${event.eventId}`);
      console.log(`  Authorization: ${event.authorization === 'AUTHORIZED' ? colors.green : colors.red}${event.authorization}${colors.reset}`);
      console.log(`  Decision     : ${formatDecision(decision.action)}`);
      console.log(`  Reasons      : ${colors.gray}${decision.reason.join(' | ')}${colors.reset}\n`);
    }

    // 4. End Session
    console.log(`${colors.bright}Step 4: Concluding Agent Session...${colors.reset}`);
    const endRes = await request(`/sessions/${session.id}/end`, {
      method: 'POST'
    });

    const endedSession = endRes.session || endRes.data?.session;
    console.log(`  Session ID   : ${endedSession.id}`);
    console.log(`  Status       : ${colors.green}${endedSession.status}${colors.reset}`);
    console.log(`  Ended At     : ${endedSession.endedAt}`);

    console.log(`
${colors.bright}${colors.green}============================================================
 DEMO COMPLETE: Sentinel 2.0 Successfully Controlled Agent!
============================================================${colors.reset}
`);
  } catch (err: unknown) {
    console.error(`\n${colors.red}${colors.bright}[ERROR] Demo failed:${colors.reset}`, (err as Error).message);
    process.exit(1);
  }
}

runDemo();
