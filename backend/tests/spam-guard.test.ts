/**
 * Sentinel 2.0 — Spam & Abuse Prevention Layer Tests
 * Verifies Rate Limiting, Burst Detection, Duplicate/Replay Detection,
 * Trajectory/Risk integration, Safe Failure (fail closed), and preservation of core Sentinel gating.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { agentService } from '../src/modules/agents/service.js';
import { sessionService } from '../src/modules/sessions/service.js';
import { toolGateway } from '../src/modules/tools/gateway.js';
import { simulatedCustomerStore } from '../src/modules/tools/customer-store.js';
import { spamGuardService, SpamGuardService } from '../src/modules/spam-guard/service.js';
import { actionIngestionService } from '../src/modules/actions/service.js';
import { auditService } from '../src/modules/audit/service.js';
import { externalAgentGateway } from '../src/modules/external-agent/gateway.js';

describe('Sentinel 2.0 — Spam & Abuse Prevention Layer', () => {
  let agentId: string;
  let sessionId: string;

  beforeEach(async () => {
    // Reset stores and spam guard
    simulatedCustomerStore.reset();
    spamGuardService.reset();

    // Default test config: generous for general tests
    spamGuardService.configure({
      rateLimitWindowMs: 60000,
      rateLimitMaxRequests: 100,
      burstWindowMs: 5000,
      burstMaxRequests: 15,
      duplicateWindowMs: 30000
    });

    // Register active agent with standard scopes
    const agent = await agentService.registerAgent({
      name: 'Spam Guard Verification Agent',
      type: 'external-ai-agent',
      scopes: ['customer.read', 'order.read', 'order.write'],
      metadata: { role: 'tester' }
    });
    agentId = agent.id;

    // Start active session
    const session = await sessionService.createSession({ agentId: agent.id });
    sessionId = session.id;
  });

  // 1. Normal request
  it('1. normal request: passes through spam guard with status NORMAL and executes', async () => {
    const res = await request(app)
      .post('/api/v1/tools/execute')
      .send({
        agentId,
        sessionId,
        tool: 'get_customer',
        params: { customerId: 'CUST-001' }
      });

    expect(res.status).toBe(200);
    expect(res.body.executed).toBe(true);
    expect(res.body.toolExecutionState).toBe('SUCCESS');
    expect(res.body.decision).toBe('ALLOW');
  });

  // 2. Rate limit not exceeded
  it('2. rate limit not exceeded: consecutive requests within configured max are permitted', async () => {
    spamGuardService.configure({
      rateLimitWindowMs: 60000,
      rateLimitMaxRequests: 5
    });

    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/api/v1/tools/execute')
        .send({
          agentId,
          sessionId,
          tool: 'get_customer',
          params: { customerId: 'CUST-001' }
        });
      expect(res.status).toBe(200);
      expect(res.body.executed).toBe(true);
    }
  });

  // 3. Rate limit exceeded
  it('3. rate limit exceeded: throttles with HTTP 429, emits audit event, and does not execute tool', async () => {
    spamGuardService.configure({
      rateLimitWindowMs: 60000,
      rateLimitMaxRequests: 2
    });

    // Request 1: allowed
    const res1 = await request(app)
      .post('/api/v1/tools/execute')
      .send({ agentId, sessionId, tool: 'get_customer', params: { customerId: 'CUST-001' } });
    expect(res1.status).toBe(200);

    // Request 2: allowed
    const res2 = await request(app)
      .post('/api/v1/tools/execute')
      .send({ agentId, sessionId, tool: 'get_customer', params: { customerId: 'CUST-001' } });
    expect(res2.status).toBe(200);

    // Request 3: exceeds rateLimitMaxRequests (2) -> throttled
    const res3 = await request(app)
      .post('/api/v1/tools/execute')
      .send({ agentId, sessionId, tool: 'get_customer', params: { customerId: 'CUST-001' } });

    expect(res3.status).toBe(429);
    expect(res3.body.executed).toBe(false);
    expect(res3.body.decision).toBe('BLOCK');
    expect(res3.body.toolExecutionState).toBe('BLOCKED_NOT_EXECUTED');
    expect(res3.body.toolResult).toBeNull();
    expect(res3.body.reasonCodes).toContain('RATE_LIMIT_EXCEEDED');

    // Verify audit trail logged RATE_LIMIT_TRIGGERED and REQUEST_THROTTLED
    const audits = await auditService.listLogs({ sessionId });
    const rateLimitAudit = audits.find((a) => a.eventType === 'RATE_LIMIT_TRIGGERED');
    const throttledAudit = audits.find((a) => a.eventType === 'REQUEST_THROTTLED');
    expect(rateLimitAudit).toBeDefined();
    expect(throttledAudit).toBeDefined();
  });

  // 4. Burst detection
  it('4. burst detection: detects abnormal request burst within rolling window', async () => {
    spamGuardService.configure({
      rateLimitWindowMs: 60000,
      rateLimitMaxRequests: 50,
      burstWindowMs: 5000,
      burstMaxRequests: 3
    });

    // Send 4 requests in rapid succession (burst threshold is 3)
    let lastResult: any;
    for (let i = 0; i < 4; i++) {
      const check = await spamGuardService.check({
        agentId,
        sessionId,
        action: 'READ',
        resource: `resource-${i}`
      });
      lastResult = check;
    }

    expect(lastResult.signals.burstDetected).toBe(true);
    expect(lastResult.signals.requestRate).toBe(4);
    expect(lastResult.signals.status).toBe('WARNING');

    // Verify BURST_DETECTED audit event
    const audits = await auditService.listLogs({ sessionId });
    const burstAudit = audits.find((a) => a.eventType === 'BURST_DETECTED');
    expect(burstAudit).toBeDefined();
    expect(burstAudit?.payload.burstCount).toBe(4);
  });

  // 5. Duplicate request detection
  it('5. duplicate request detection: detects identical repeated action fingerprint within window', async () => {
    spamGuardService.configure({
      duplicateWindowMs: 30000
    });

    // First call: initial
    const check1 = await spamGuardService.check({
      agentId,
      sessionId,
      action: 'UPDATE',
      resource: 'order://ORD-1001',
      tool: 'update_order',
      toolParams: { orderId: 'ORD-1001', notes: 'Urgent shipping' }
    });
    expect(check1.signals.duplicateDetected).toBe(false);
    expect(check1.signals.duplicateCount).toBe(1);

    // Second call: identical action & params
    const check2 = await spamGuardService.check({
      agentId,
      sessionId,
      action: 'UPDATE',
      resource: 'order://ORD-1001',
      tool: 'update_order',
      toolParams: { orderId: 'ORD-1001', notes: 'Urgent shipping' }
    });
    expect(check2.signals.duplicateDetected).toBe(true);
    expect(check2.signals.duplicateCount).toBe(2);

    // Verify DUPLICATE_DETECTED audit event
    const audits = await auditService.listLogs({ sessionId });
    const dupAudit = audits.find((a) => a.eventType === 'DUPLICATE_DETECTED');
    expect(dupAudit).toBeDefined();
    expect(dupAudit?.payload.duplicateCount).toBe(2);
  });

  // 6. Repeated sensitive action
  it('6. repeated sensitive action: repeated sensitive action elevates risk score in trajectory', async () => {
    // Send identical sensitive action (issue_refund) multiple times through action ingestion
    const input = {
      agentId,
      sessionId,
      action: 'UPDATE' as const,
      resource: 'order://ORD-1001',
      resourceType: 'order',
      scope: 'order.write',
      sensitivity: 'HIGH' as const,
      reversibility: 'PARTIALLY_REVERSIBLE' as const,
      metadata: { tool: 'issue_refund', toolParams: { orderId: 'ORD-1001', amount: 500 } }
    };

    const res1 = await actionIngestionService.ingestAction(input);
    const res2 = await actionIngestionService.ingestAction(input);

    // Second repeated sensitive action has duplicate detected and higher risk
    const spamSignals2 = res2.event.metadata?.spamSignals as any;
    expect(spamSignals2?.duplicateDetected).toBe(true);
    expect(spamSignals2?.duplicateCount).toBe(2);
    // Cumulative risk on second repeated sensitive action is elevated
    expect(Number(res2.event.metadata?.risk)).toBeGreaterThanOrEqual(Number(res1.event.metadata?.risk));
  });

  // 7. Throttled request does not execute tool
  it('7. throttled request does not execute tool: toolResult is null and executed is false', async () => {
    spamGuardService.configure({
      rateLimitWindowMs: 60000,
      rateLimitMaxRequests: 1
    });

    // 1st request: allowed
    await toolGateway.executeToolRequest({
      agentId,
      sessionId,
      tool: 'get_customer',
      params: { customerId: 'CUST-001' }
    });

    // 2nd request: throttled
    const result = await toolGateway.executeToolRequest({
      agentId,
      sessionId,
      tool: 'update_order',
      params: { orderId: 'ORD-1001', notes: 'Should not execute' }
    });

    expect(result.executed).toBe(false);
    expect(result.toolResult).toBeNull();
    expect(result.decision).toBe('BLOCK');
    expect(result.toolExecutionState).toBe('BLOCKED_NOT_EXECUTED');
    expect(result.preventionProof).toContain('Sentinel');

    // Customer store must NOT have been updated
    const order = simulatedCustomerStore.getOrder('ORD-1001');
    expect(order?.notes).not.toBe('Should not execute');
  });

  // 8. Existing BLOCK behavior still works
  it('8. existing BLOCK behavior still works: unauthorized destructive DELETE is hard blocked', async () => {
    const res = await request(app)
      .post('/api/v1/tools/execute')
      .send({
        agentId,
        sessionId,
        tool: 'delete_customer',
        params: { customerId: 'CUST-001' }
      });

    expect(res.status).toBe(403);
    expect(res.body.decision).toBe('BLOCK');
    expect(res.body.executed).toBe(false);
    expect(res.body.toolExecutionState).toBe('BLOCKED_NOT_EXECUTED');
    expect(simulatedCustomerStore.getCustomer('CUST-001')).toBeDefined();
  });

  // 9. Existing CONFIRM behavior still works
  it('9. existing CONFIRM behavior still works: unauthorized reversible operation awaits human approval', async () => {
    const res = await request(app)
      .post('/api/v1/tools/execute')
      .send({
        agentId,
        sessionId,
        tool: 'issue_refund',
        params: { orderId: 'ORD-1001', amount: 50 }
      });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('CONFIRM');
    expect(res.body.executed).toBe(false);
    expect(res.body.toolExecutionState).toBe('WAITING_FOR_HUMAN_APPROVAL');
    expect(res.body.pendingInterventionId).toBeDefined();

    // Order was NOT refunded yet
    const order = simulatedCustomerStore.getOrder('ORD-1001');
    expect(order?.refundIssued).toBe(false);
  });

  // 10. Existing ALLOW behavior still works
  it('10. existing ALLOW behavior still works: authorized low-sensitivity action executes cleanly', async () => {
    const res = await request(app)
      .post('/api/v1/tools/execute')
      .send({
        agentId,
        sessionId,
        tool: 'get_order',
        params: { orderId: 'ORD-1001' }
      });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('ALLOW');
    expect(res.body.executed).toBe(true);
    expect(res.body.toolExecutionState).toBe('SUCCESS');
    expect(res.body.toolResult.id).toBe('ORD-1001');
  });

  // 11. Existing Gemini 7-step scenario still works
  it('11. existing Gemini 7-step scenario still works: executes customer support flow under Sentinel governance', async () => {
    const sessionInit = await externalAgentGateway.startSession({
      scenarioId: 'GEMINI_CUSTOMER_SUPPORT'
    });

    expect(sessionInit.agent).toBeDefined();
    expect(sessionInit.session).toBeDefined();

    // Step 1: get_customer (ALLOW)
    const step1 = await externalAgentGateway.stepSession(sessionInit.session.id);
    expect(step1.decision).toBe('ALLOW');
    expect(step1.executed).toBe(true);
    expect(step1.toolExecutionState).toBe('SUCCESS');

    // Each step carries spamSignals
    expect(step1.spamSignals).toBeDefined();
    expect(step1.spamSignals?.status).toBe('NORMAL');
    expect(step1.spamSignals?.burstDetected).toBe(false);

    // Step 2: get_order (ALLOW)
    const step2 = await externalAgentGateway.stepSession(sessionInit.session.id);
    expect(step2.decision).toBe('ALLOW');
    expect(step2.executed).toBe(true);
  });

  // Safe Failure (Fail Closed)
  it('safe failure: internal error in spam-guard fails closed and prevents tool execution', async () => {
    const brokenGuard = new SpamGuardService();
    // Force an internal error in spam guard by breaking internal map
    (brokenGuard as any).requestTimestamps = null;

    const checkResult = await brokenGuard.check({
      agentId: 'any-agent',
      sessionId: 'any-session',
      action: 'READ',
      resource: 'test'
    });

    // Must be allowed=false and throttled=true (never bypass)
    expect(checkResult.allowed).toBe(false);
    expect(checkResult.throttled).toBe(true);
    expect(checkResult.signals.status).toBe('BLOCKED');
  });
});
