import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { agentService } from '../src/modules/agents/service.js';
import { sessionService } from '../src/modules/sessions/service.js';
import { toolGateway } from '../src/modules/tools/gateway.js';
import { simulatedCustomerStore } from '../src/modules/tools/customer-store.js';
import { externalAgentGateway } from '../src/modules/external-agent/gateway.js';
import { auditService } from '../src/modules/audit/service.js';

describe('Sentinel 2.0 — Tool Gateway Security & Protected Tool Enforcement', () => {
  let agentId: string;
  let sessionId: string;

  beforeEach(async () => {
    // Reset simulated customer database to initial state
    simulatedCustomerStore.reset();

    // Register Customer Support Agent with scoped permissions
    const agent = await agentService.registerAgent({
      name: 'Gemini Customer Support Agent',
      type: 'external-ai-agent',
      scopes: ['customer.read', 'order.read', 'order.write'],
      metadata: { department: 'support-tier-1' }
    });
    agentId = agent.id;

    // Start governed session
    const session = await sessionService.createSession({ agentId: agent.id });
    sessionId = session.id;
  });

  // A. ALLOW executes the tool
  it('A. ALLOW executes the tool: authorized read operation successfully fetches customer', async () => {
    const res = await request(app)
      .post('/api/v1/tools/execute')
      .send({
        agentId,
        sessionId,
        tool: 'get_customer',
        params: { customerId: 'CUST-001' }
      });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('ALLOW');
    expect(res.body.executed).toBe(true);
    expect(res.body.toolExecutionState).toBe('SUCCESS');
    expect(res.body.toolResult).toBeDefined();
    expect(res.body.toolResult.id).toBe('CUST-001');
    expect(res.body.toolResult.name).toBe('Acme Corp / Sarah Chen');
    expect(res.body.toolResult.status).toBe('ACTIVE');
  });

  // B. MONITOR executes the tool and records telemetry
  it('B. MONITOR executes the tool and records telemetry: medium sensitivity update runs under observation', async () => {
    const res = await request(app)
      .post('/api/v1/tools/execute')
      .send({
        agentId,
        sessionId,
        tool: 'update_order',
        params: {
          orderId: 'ORD-1001',
          notes: 'Customer requested expedited courier dispatch.'
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('MONITOR');
    expect(res.body.executed).toBe(true);
    expect(res.body.toolExecutionState).toBe('SUCCESS');

    // Verify in-memory store was genuinely updated
    const orderInStore = simulatedCustomerStore.getOrder('ORD-1001');
    expect(orderInStore).not.toBeNull();
    expect(orderInStore?.notes).toBe('Customer requested expedited courier dispatch.');

    // Verify audit logs record telemetry
    const auditLogs = await auditService.listLogs({ sessionId });
    const monitorLog = auditLogs.find((l) => l.eventType === 'TOOL_EXECUTION_MONITORED');
    expect(monitorLog).toBeDefined();
    expect(monitorLog?.payload.executed).toBe(true);
    expect(monitorLog?.payload.telemetryRecorded).toBe(true);
  });

  // C. CONFIRM does not execute until approved
  it('C. CONFIRM does not execute until approved: unauthorized refund is held until human approval', async () => {
    // 1. Initial request triggers CONFIRM
    const res = await request(app)
      .post('/api/v1/tools/execute')
      .send({
        agentId,
        sessionId,
        tool: 'issue_refund',
        params: { orderId: 'ORD-1001', amount: 350.0 }
      });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('CONFIRM');
    expect(res.body.executed).toBe(false);
    expect(res.body.toolExecutionState).toBe('WAITING_FOR_HUMAN_APPROVAL');
    expect(res.body.toolResult).toBeNull();

    // Verify in-memory store: Order MUST NOT be refunded yet!
    const beforeApproval = simulatedCustomerStore.getOrder('ORD-1001');
    expect(beforeApproval?.refundIssued).toBe(false);
    expect(beforeApproval?.status).toBe('DELIVERED');

    // Verify tool is held in ToolGateway pending queue
    const pending = toolGateway.getPendingExecution(sessionId);
    expect(pending).not.toBeNull();
    expect(pending?.tool).toBe('issue_refund');

    // 2. Human reviewer approves via ALLOW_ONCE
    const approvedRes = await toolGateway.executePendingTool(
      sessionId,
      'ALLOW_ONCE',
      'lead-secops-reviewer',
      'Customer order was legitimately delayed; refund authorized'
    );

    expect(approvedRes.decision).toBe('ALLOW');
    expect(approvedRes.executed).toBe(true);
    expect(approvedRes.toolExecutionState).toBe('SUCCESS');

    // Verify in-memory store: Order is NOW refunded
    const afterApproval = simulatedCustomerStore.getOrder('ORD-1001');
    expect(afterApproval?.refundIssued).toBe(true);
    expect(afterApproval?.refundAmount).toBe(350.0);
    expect(afterApproval?.status).toBe('REFUNDED');
  });

  // D. REJECT prevents execution
  it('D. REJECT prevents execution: human review rejection strictly prevents tool execution', async () => {
    // Trigger CONFIRM on refund
    const res = await request(app)
      .post('/api/v1/tools/execute')
      .send({
        agentId,
        sessionId,
        tool: 'issue_refund',
        params: { orderId: 'ORD-1001', amount: 350.0 }
      });

    expect(res.body.decision).toBe('CONFIRM');
    expect(res.body.executed).toBe(false);

    // Operator denies execution
    const denyRes = await toolGateway.executePendingTool(
      sessionId,
      'DENY',
      'lead-secops-reviewer',
      'Suspicious refund pattern detected'
    );

    expect(denyRes.decision).toBe('BLOCK');
    expect(denyRes.executed).toBe(false);
    expect(denyRes.toolExecutionState).toBe('DENIED_NOT_EXECUTED');
    expect(denyRes.preventionProof).toContain('Sentinel prevented this action');

    // Verify in-memory store: Order was NEVER refunded
    const orderInStore = simulatedCustomerStore.getOrder('ORD-1001');
    expect(orderInStore?.refundIssued).toBe(false);
    expect(orderInStore?.status).toBe('DELIVERED');
  });

  // E. BLOCK prevents execution
  it('E. BLOCK prevents execution: unauthorized destructive deletion is strictly blocked without executing', async () => {
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
    expect(res.body.tool).toBe('delete_customer');
    expect(res.body.toolExecutionState).toBe('BLOCKED_NOT_EXECUTED');
    expect(res.body.toolResult).toBeNull();
    expect(res.body.preventionProof).toBe('Sentinel prevented this action.');
    expect(res.body.reasonCodes).toBeDefined();

    // Verify in-memory store: Customer profile MUST STILL BE ACTIVE (not DELETED!)
    const customerInStore = simulatedCustomerStore.getCustomer('CUST-001');
    expect(customerInStore).not.toBeNull();
    expect(customerInStore?.status).toBe('ACTIVE');
  });

  // F. Direct attempts to bypass Sentinel's decision endpoint are rejected
  it('F. Direct attempts to bypass Sentinel decision endpoint are rejected', async () => {
    // Missing agentId
    const res1 = await request(app)
      .post('/api/v1/tools/execute')
      .send({ sessionId, tool: 'delete_customer' });
    expect(res1.status).toBe(400);

    // Missing sessionId
    const res2 = await request(app)
      .post('/api/v1/tools/execute')
      .send({ agentId, tool: 'delete_customer' });
    expect(res2.status).toBe(400);

    // Nonexistent session
    const res3 = await request(app)
      .post('/api/v1/tools/execute')
      .send({ agentId, sessionId: 'sess-fake-nonexistent', tool: 'get_customer' });
    expect(res3.status).toBe(404);

    // Revoked agent cannot execute
    await agentService.revokeAgent(agentId);
    const res4 = await request(app)
      .post('/api/v1/tools/execute')
      .send({ agentId, sessionId, tool: 'get_customer' });
    expect(res4.status).toBe(403);
  });

  // G. Frontend cannot directly invoke protected tool execution
  it('G. Frontend cannot directly invoke protected tool execution without Sentinel decision gate', async () => {
    // Proves there is no raw bypass route like POST /api/v1/customers/delete
    const directDelete = await request(app).delete('/api/v1/customers/CUST-001');
    expect(directDelete.status).toBe(404);

    const directRefund = await request(app).post('/api/v1/orders/ORD-1001/refund');
    expect(directRefund.status).toBe(404);
  });

  // H. Gemini cannot directly access the simulated customer tool
  it('H. Gemini cannot directly access simulated customer tool; actions are strictly governed through Sentinel', async () => {
    const runResult = await externalAgentGateway.runFullSession({
      scenarioId: 'GEMINI_CUSTOMER_SUPPORT',
      autoApproveConfirm: true,
      maxSteps: 7
    });

    expect(runResult.agent.name).toBe('Gemini Support Agent');
    expect(runResult.totalSteps).toBe(7);

    // Step 1: get_customer -> ALLOW -> executed
    expect(runResult.steps[0].proposedAction.tool).toBe('get_customer');
    expect(runResult.steps[0].decision).toBe('ALLOW');
    expect(runResult.steps[0].executed).toBe(true);

    // Step 2: get_order -> ALLOW -> executed
    expect(runResult.steps[1].proposedAction.tool).toBe('get_order');
    expect(runResult.steps[1].decision).toBe('ALLOW');
    expect(runResult.steps[1].executed).toBe(true);

    // Step 3: update_order -> MONITOR -> executed
    expect(runResult.steps[2].proposedAction.tool).toBe('update_order');
    expect(runResult.steps[2].decision).toBe('MONITOR');
    expect(runResult.steps[2].executed).toBe(true);

    // Step 4: issue_refund -> CONFIRM -> executed only after approval
    expect(runResult.steps[3].proposedAction.tool).toBe('issue_refund');
    expect(runResult.steps[3].decision).toBe('CONFIRM');

    // Step 7: delete_customer -> BLOCK -> tool strictly NOT executed
    const lastStep = runResult.steps[runResult.steps.length - 1];
    expect(lastStep.proposedAction.tool).toBe('delete_customer');
    expect(lastStep.decision).toBe('BLOCK');
    expect(lastStep.executed).toBe(false);
    expect(lastStep.toolExecutionState).toBe('BLOCKED_NOT_EXECUTED');

    // Customer in store remains ACTIVE
    const customer = simulatedCustomerStore.getCustomer('CUST-001');
    expect(customer?.status).toBe('ACTIVE');
  });

  // I. A blocked destructive action produces an audit event with executed=false
  it('I. A blocked destructive action produces an audit event with executed=false', async () => {
    await request(app)
      .post('/api/v1/tools/execute')
      .send({
        agentId,
        sessionId,
        tool: 'delete_customer',
        params: { customerId: 'CUST-001' }
      });

    const auditLogs = await auditService.listLogs({ sessionId });
    const blockAudit = auditLogs.find((l) => l.eventType === 'TOOL_EXECUTION_BLOCKED');

    expect(blockAudit).toBeDefined();
    expect(blockAudit?.payload.executed).toBe(false);
    expect(blockAudit?.payload.requestedAction).toBe('delete_customer');
    expect(blockAudit?.payload.decision).toBe('BLOCK');
    expect(blockAudit?.payload.preventionProof).toBe('Sentinel prevented this action.');
  });
});
