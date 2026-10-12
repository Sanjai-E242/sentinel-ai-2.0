import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { agentRepository } from '../src/modules/agents/repository.js';
import { sessionRepository } from '../src/modules/sessions/repository.js';

describe('Session Management API (/api/v1/sessions)', () => {
  beforeEach(async () => {
    if (agentRepository.clear) await agentRepository.clear();
    if (sessionRepository.clear) await sessionRepository.clear();
  });

  it('5. Successfully creates a session for an active agent', async () => {
    await agentRepository.create({
      id: 'agent-session-1',
      name: 'Session Agent',
      type: 'external-ai-agent',
      status: 'ACTIVE',
      scopes: ['project.read'],
      createdAt: new Date().toISOString()
    });

    const res = await request(app)
      .post('/api/v1/sessions')
      .send({ agentId: 'agent-session-1' })
      .expect(201);

    expect(res.body.session).toBeDefined();
    expect(res.body.session.id).toBeDefined();
    expect(res.body.session.agentId).toBe('agent-session-1');
    expect(res.body.session.status).toBe('ACTIVE');
    expect(res.body.session.startedAt).toBeDefined();
    expect(res.body.session.currentRisk).toBe(0);
    expect(res.body.session.trajectoryDeviation).toBe(0);
    expect(res.body.requestId).toBeDefined();
  });

  it('6. Rejects session creation for a nonexistent agent', async () => {
    const res = await request(app)
      .post('/api/v1/sessions')
      .send({ agentId: 'nonexistent-agent' })
      .expect(404);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('AGENT_NOT_FOUND');
  });

  it('Rejects session creation for a revoked agent', async () => {
    await agentRepository.create({
      id: 'agent-revoked',
      name: 'Revoked Agent',
      type: 'external-ai-agent',
      status: 'REVOKED',
      scopes: ['project.read'],
      createdAt: new Date().toISOString()
    });

    const res = await request(app)
      .post('/api/v1/sessions')
      .send({ agentId: 'agent-revoked' })
      .expect(403);

    expect(res.body.error.code).toBe('AGENT_REVOKED');
  });

  it('7. Retrieves an existing session by ID', async () => {
    const session = await sessionRepository.create({
      id: 'sess-test-1',
      agentId: 'agent-1',
      status: 'ACTIVE',
      startedAt: new Date().toISOString(),
      currentRisk: 0,
      trajectoryDeviation: 0
    });

    const res = await request(app)
      .get(`/api/v1/sessions/${session.id}`)
      .expect(200);

    expect(res.body.session).toBeDefined();
    expect(res.body.session.id).toBe('sess-test-1');
  });

  it('8. Successfully ends an active session', async () => {
    const session = await sessionRepository.create({
      id: 'sess-test-to-end',
      agentId: 'agent-1',
      status: 'ACTIVE',
      startedAt: new Date().toISOString(),
      currentRisk: 0,
      trajectoryDeviation: 0
    });

    const res = await request(app)
      .post(`/api/v1/sessions/${session.id}/end`)
      .expect(200);

    expect(res.body.session).toBeDefined();
    expect(res.body.session.status).toBe('COMPLETED');
    expect(res.body.session.endedAt).toBeDefined();

    // Verify subsequent end attempts are rejected
    const retryRes = await request(app)
      .post(`/api/v1/sessions/${session.id}/end`)
      .expect(400);

    expect(retryRes.body.error.code).toBe('SESSION_ALREADY_COMPLETED');
  });
});
