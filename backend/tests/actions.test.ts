import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { agentRepository } from '../src/modules/agents/repository.js';
import { sessionRepository } from '../src/modules/sessions/repository.js';
import { actionEventRepository } from '../src/modules/actions/repository.js';

describe('Action Ingestion API (/api/v1/actions)', () => {
  const agentId = 'research-agent-01';
  const sessionId = 'session-123';

  beforeEach(async () => {
    if (agentRepository.clear) await agentRepository.clear();
    if (sessionRepository.clear) await sessionRepository.clear();
    if (actionEventRepository.clear) await actionEventRepository.clear();

    // Seed test agent and session
    await agentRepository.create({
      id: agentId,
      name: 'Research Agent',
      type: 'external-ai-agent',
      status: 'ACTIVE',
      scopes: ['project.read', 'project.write'],
      createdAt: new Date().toISOString()
    });

    await sessionRepository.create({
      id: sessionId,
      agentId: agentId,
      status: 'ACTIVE',
      startedAt: new Date().toISOString(),
      currentRisk: 0,
      trajectoryDeviation: 0
    });
  });

  it('10. Accepts valid action and returns event with decision', async () => {
    const payload = {
      agentId,
      sessionId,
      action: 'READ',
      resource: 'project-documents',
      resourceType: 'document',
      scope: 'project.read',
      sensitivity: 'low',
      reversibility: 'reversible'
    };

    const res = await request(app)
      .post('/api/v1/actions')
      .send(payload)
      .expect(200);

    expect(res.body.event).toBeDefined();
    expect(res.body.event.eventId).toBeDefined();
    expect(res.body.event.authorization).toBe('AUTHORIZED');
    expect(res.body.decision).toBeDefined();
    expect(res.body.decision.action).toBe('ALLOW');
    expect(res.body.requestId).toBeDefined();
  });

  it('11. Rejects nonexistent agent', async () => {
    const res = await request(app)
      .post('/api/v1/actions')
      .send({
        agentId: 'nonexistent-agent',
        sessionId,
        action: 'READ',
        resource: 'doc',
        resourceType: 'doc',
        scope: 'project.read',
        sensitivity: 'low',
        reversibility: 'reversible'
      })
      .expect(404);

    expect(res.body.error.code).toBe('AGENT_NOT_FOUND');
  });

  it('12. Rejects revoked agent', async () => {
    await agentRepository.create({
      id: 'agent-revoked',
      name: 'Revoked',
      type: 'ai',
      status: 'REVOKED',
      scopes: ['project.read'],
      createdAt: new Date().toISOString()
    });
    const revokedSession = await sessionRepository.create({
      id: 'sess-revoked',
      agentId: 'agent-revoked',
      status: 'ACTIVE',
      startedAt: new Date().toISOString(),
      currentRisk: 0,
      trajectoryDeviation: 0
    });

    const res = await request(app)
      .post('/api/v1/actions')
      .send({
        agentId: 'agent-revoked',
        sessionId: revokedSession.id,
        action: 'READ',
        resource: 'doc',
        resourceType: 'doc',
        scope: 'project.read',
        sensitivity: 'low',
        reversibility: 'reversible'
      })
      .expect(403);

    expect(res.body.error.code).toBe('AGENT_REVOKED');
  });

  it('13. Rejects nonexistent session', async () => {
    const res = await request(app)
      .post('/api/v1/actions')
      .send({
        agentId,
        sessionId: 'nonexistent-session',
        action: 'READ',
        resource: 'doc',
        resourceType: 'doc',
        scope: 'project.read',
        sensitivity: 'low',
        reversibility: 'reversible'
      })
      .expect(404);

    expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('14. Rejects session-agent mismatch', async () => {
    // Create another agent
    await agentRepository.create({
      id: 'other-agent',
      name: 'Other Agent',
      type: 'ai',
      status: 'ACTIVE',
      scopes: ['project.read'],
      createdAt: new Date().toISOString()
    });

    const res = await request(app)
      .post('/api/v1/actions')
      .send({
        agentId: 'other-agent',
        sessionId, // belongs to research-agent-01
        action: 'READ',
        resource: 'doc',
        resourceType: 'doc',
        scope: 'project.read',
        sensitivity: 'low',
        reversibility: 'reversible'
      })
      .expect(400);

    expect(res.body.error.code).toBe('SESSION_AGENT_MISMATCH');
  });

  it('9. Rejects actions after session ends', async () => {
    await sessionRepository.update({
      id: sessionId,
      agentId,
      status: 'COMPLETED',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      currentRisk: 0,
      trajectoryDeviation: 0
    });

    const res = await request(app)
      .post('/api/v1/actions')
      .send({
        agentId,
        sessionId,
        action: 'READ',
        resource: 'doc',
        resourceType: 'doc',
        scope: 'project.read',
        sensitivity: 'low',
        reversibility: 'reversible'
      })
      .expect(400);

    expect(res.body.error.code).toBe('SESSION_ALREADY_COMPLETED');
  });

  it('15. Rejects malformed action payload (invalid enum)', async () => {
    const res = await request(app)
      .post('/api/v1/actions')
      .send({
        agentId,
        sessionId,
        action: 'INVALID_ACTION_NAME',
        resource: 'doc',
        resourceType: 'doc',
        scope: 'project.read',
        sensitivity: 'low',
        reversibility: 'reversible'
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('16. Correctly identifies authorized scope', async () => {
    const res = await request(app)
      .post('/api/v1/actions')
      .send({
        agentId,
        sessionId,
        action: 'READ',
        resource: 'project-notes',
        resourceType: 'document',
        scope: 'project.read',
        sensitivity: 'low',
        reversibility: 'reversible'
      })
      .expect(200);

    expect(res.body.event.authorization).toBe('AUTHORIZED');
  });

  it('17. Correctly identifies unauthorized scope', async () => {
    const res = await request(app)
      .post('/api/v1/actions')
      .send({
        agentId,
        sessionId,
        action: 'READ',
        resource: 'salary-data',
        resourceType: 'document',
        scope: 'finance.read', // Not in ['project.read', 'project.write']
        sensitivity: 'low',
        reversibility: 'reversible'
      })
      .expect(200);

    expect(res.body.event.authorization).toBe('UNAUTHORIZED');
  });

  it('18. Authorized READ + low sensitivity + reversible → ALLOW', async () => {
    const res = await request(app)
      .post('/api/v1/actions')
      .send({
        agentId,
        sessionId,
        action: 'READ',
        resource: 'project-readme',
        resourceType: 'document',
        scope: 'project.read',
        sensitivity: 'low',
        reversibility: 'reversible'
      })
      .expect(200);

    expect(res.body.decision.action).toBe('ALLOW');
    expect(res.body.decision.reason).toContain('Requested scope is authorized');
  });

  it('19. Authorized + medium sensitivity → MONITOR', async () => {
    const res = await request(app)
      .post('/api/v1/actions')
      .send({
        agentId,
        sessionId,
        action: 'WRITE',
        resource: 'project-config',
        resourceType: 'configuration',
        scope: 'project.write',
        sensitivity: 'medium',
        reversibility: 'reversible'
      })
      .expect(200);

    expect(res.body.decision.action).toBe('MONITOR');
  });

  it('20. Authorized + high sensitivity → WARN', async () => {
    const res = await request(app)
      .post('/api/v1/actions')
      .send({
        agentId,
        sessionId,
        action: 'WRITE',
        resource: 'production-api-keys',
        resourceType: 'secret',
        scope: 'project.write',
        sensitivity: 'high',
        reversibility: 'reversible'
      })
      .expect(200);

    expect(res.body.decision.action).toBe('WARN');
  });

  it('21. Unauthorized + reversible → CONFIRM', async () => {
    const res = await request(app)
      .post('/api/v1/actions')
      .send({
        agentId,
        sessionId,
        action: 'READ',
        resource: 'customer-data',
        resourceType: 'database',
        scope: 'crm.read', // unauthorized
        sensitivity: 'low',
        reversibility: 'reversible'
      })
      .expect(200);

    expect(res.body.event.authorization).toBe('UNAUTHORIZED');
    expect(res.body.decision.action).toBe('CONFIRM');
  });

  it('22. Unauthorized + DELETE → BLOCK', async () => {
    const res = await request(app)
      .post('/api/v1/actions')
      .send({
        agentId,
        sessionId,
        action: 'DELETE',
        resource: 'production-database',
        resourceType: 'database',
        scope: 'db.delete', // unauthorized
        sensitivity: 'high',
        reversibility: 'irreversible'
      })
      .expect(200);

    expect(res.body.event.authorization).toBe('UNAUTHORIZED');
    expect(res.body.decision.action).toBe('BLOCK');
  });

  it('23. Unauthorized + privilege escalation → BLOCK', async () => {
    const res = await request(app)
      .post('/api/v1/actions')
      .send({
        agentId,
        sessionId,
        action: 'PRIVILEGE_ESCALATION',
        resource: 'sudo-root',
        resourceType: 'system',
        scope: 'admin.grant', // unauthorized
        sensitivity: 'critical',
        reversibility: 'reversible'
      })
      .expect(200);

    expect(res.body.event.authorization).toBe('UNAUTHORIZED');
    expect(res.body.decision.action).toBe('BLOCK');
  });

  it('Retrieves list of actions and single action by ID', async () => {
    const postRes = await request(app)
      .post('/api/v1/actions')
      .send({
        agentId,
        sessionId,
        action: 'READ',
        resource: 'doc-1',
        resourceType: 'doc',
        scope: 'project.read',
        sensitivity: 'low',
        reversibility: 'reversible'
      })
      .expect(200);

    const eventId = postRes.body.event.eventId;

    // Get single
    const singleRes = await request(app)
      .get(`/api/v1/actions/${eventId}`)
      .expect(200);

    expect(singleRes.body.event.eventId).toBe(eventId);

    // List all
    const listRes = await request(app)
      .get('/api/v1/actions')
      .expect(200);

    expect(listRes.body.events.length).toBeGreaterThan(0);
  });
});
