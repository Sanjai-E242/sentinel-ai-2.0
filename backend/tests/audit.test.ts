import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { agentRepository } from '../src/modules/agents/repository.js';
import { sessionRepository } from '../src/modules/sessions/repository.js';
import { actionEventRepository } from '../src/modules/actions/repository.js';
import { auditLogRepository } from '../src/modules/audit/repository.js';

describe('Audit Trail & Security Logging', () => {
  beforeEach(async () => {
    if (agentRepository.clear) await agentRepository.clear();
    if (sessionRepository.clear) await sessionRepository.clear();
    if (actionEventRepository.clear) await actionEventRepository.clear();
    if (auditLogRepository.clear) await auditLogRepository.clear();
  });

  it('generates AGENT_CREATED, AGENT_SUSPENDED, and AGENT_REVOKED audit entries', async () => {
    // 1. Register agent -> AGENT_CREATED
    const regRes = await request(app)
      .post('/api/v1/agents')
      .send({
        name: 'Audit-Agent',
        type: 'worker',
        scopes: ['file:read']
      });
    expect(regRes.status).toBe(201);
    const agentId = regRes.body.agent.id;

    // 2. Suspend agent -> AGENT_SUSPENDED
    const suspRes = await request(app)
      .post(`/api/v1/agents/${agentId}/suspend`)
      .send({ reason: 'Security maintenance' });
    expect(suspRes.status).toBe(200);

    // 3. Revoke agent -> AGENT_REVOKED
    const revRes = await request(app)
      .post(`/api/v1/agents/${agentId}/revoke`)
      .send({ reason: 'Compromised credentials' });
    expect(revRes.status).toBe(200);

    // Verify audit logs
    const auditRes = await request(app).get('/api/v1/audit');
    expect(auditRes.status).toBe(200);
    const logs = auditRes.body.logs;

    const eventTypes = logs.map((l: any) => l.eventType);
    expect(eventTypes).toContain('AGENT_CREATED');
    expect(eventTypes).toContain('AGENT_SUSPENDED');
    expect(eventTypes).toContain('AGENT_REVOKED');

    const createdLog = logs.find((l: any) => l.eventType === 'AGENT_CREATED');
    expect(createdLog.entityId).toBe(agentId);
    expect(createdLog.payload.name).toBe('Audit-Agent');
  });

  it('generates SESSION_STARTED and SESSION_COMPLETED audit entries', async () => {
    // Register agent
    const regRes = await request(app)
      .post('/api/v1/agents')
      .send({ name: 'Session-Audited-Agent', scopes: ['read:all'] });
    const agentId = regRes.body.agent.id;

    // Create session -> SESSION_STARTED
    const sessRes = await request(app)
      .post('/api/v1/sessions')
      .send({ agentId });
    expect(sessRes.status).toBe(201);
    const sessionId = sessRes.body.session.id;

    // End session -> SESSION_COMPLETED
    const endRes = await request(app)
      .post(`/api/v1/sessions/${sessionId}/end`)
      .send();
    expect(endRes.status).toBe(200);

    // Query audit by session
    const auditRes = await request(app)
      .get(`/api/v1/audit?sessionId=${sessionId}`);
    expect(auditRes.status).toBe(200);
    const logs = auditRes.body.logs;

    const eventTypes = logs.map((l: any) => l.eventType);
    expect(eventTypes).toContain('SESSION_STARTED');
    expect(eventTypes).toContain('SESSION_COMPLETED');
  });

  it('generates ACTION_INGESTED and appropriate decision audit entries (ALLOW, MONITOR, WARN, CONFIRM, BLOCK)', async () => {
    // Register agent with scoped access
    const regRes = await request(app)
      .post('/api/v1/agents')
      .send({
        name: 'Action-Audited-Agent',
        scopes: ['docs:read', 'docs:write']
      });
    const agentId = regRes.body.agent.id;

    const sessRes = await request(app)
      .post('/api/v1/sessions')
      .send({ agentId });
    const sessionId = sessRes.body.session.id;

    // 1. ALLOW action: Authorized READ low sensitivity reversible
    await request(app).post('/api/v1/actions').send({
      agentId,
      sessionId,
      action: 'READ',
      resource: 'docs:public',
      scope: 'docs:read',
      sensitivity: 'LOW',
      reversibility: 'REVERSIBLE'
    });

    // 2. MONITOR action: Authorized WRITE medium sensitivity reversible
    await request(app).post('/api/v1/actions').send({
      agentId,
      sessionId,
      action: 'WRITE',
      resource: 'docs:internal',
      scope: 'docs:write',
      sensitivity: 'MEDIUM',
      reversibility: 'REVERSIBLE'
    });

    // 3. WARN action: Authorized WRITE high sensitivity reversible
    await request(app).post('/api/v1/actions').send({
      agentId,
      sessionId,
      action: 'WRITE',
      resource: 'docs:secrets',
      scope: 'docs:write',
      sensitivity: 'HIGH',
      reversibility: 'REVERSIBLE'
    });

    // 4. CONFIRM action: Unauthorized READ reversible
    await request(app).post('/api/v1/actions').send({
      agentId,
      sessionId,
      action: 'READ',
      resource: 'financial:records',
      scope: 'financial:read',
      sensitivity: 'LOW',
      reversibility: 'REVERSIBLE'
    });

    // 5. BLOCK action: Unauthorized DELETE irreversible
    await request(app).post('/api/v1/actions').send({
      agentId,
      sessionId,
      action: 'DELETE',
      resource: 'system:root',
      scope: 'system:admin',
      sensitivity: 'CRITICAL',
      reversibility: 'IRREVERSIBLE'
    });

    // Retrieve all audit logs for this session
    const auditRes = await request(app).get(`/api/v1/audit?sessionId=${sessionId}`);
    expect(auditRes.status).toBe(200);
    const logs = auditRes.body.logs;

    const eventTypes = logs.map((l: any) => l.eventType);
    expect(eventTypes).toContain('ACTION_INGESTED');
    expect(eventTypes).toContain('ACTION_ALLOWED');
    expect(eventTypes).toContain('ACTION_MONITORED');
    expect(eventTypes).toContain('ACTION_WARNED');
    expect(eventTypes).toContain('ACTION_CONFIRM_REQUIRED');
    expect(eventTypes).toContain('ACTION_BLOCKED');
  });

  it('filters audit records by eventType', async () => {
    const regRes = await request(app)
      .post('/api/v1/agents')
      .send({ name: 'Filter-Agent', scopes: ['test:scope'] });
    const agentId = regRes.body.agent.id;

    const auditRes = await request(app).get('/api/v1/audit?eventType=AGENT_CREATED');
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.logs.length).toBeGreaterThanOrEqual(1);
    expect(auditRes.body.logs.every((l: any) => l.eventType === 'AGENT_CREATED')).toBe(true);
  });
});
