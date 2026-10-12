import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { agentRepository } from '../src/modules/agents/repository.js';

describe('Agent Management API (/api/v1/agents)', () => {
  beforeEach(async () => {
    if (agentRepository.clear) {
      await agentRepository.clear();
    }
  });

  it('1. Successfully creates an agent with valid payload', async () => {
    const payload = {
      name: 'Research Agent',
      type: 'external-ai-agent',
      scopes: ['project.read', 'project.write']
    };

    const res = await request(app)
      .post('/api/v1/agents')
      .send(payload)
      .expect(201);

    expect(res.body.agent).toBeDefined();
    expect(res.body.agent.id).toBeDefined();
    expect(res.body.agent.name).toBe('Research Agent');
    expect(res.body.agent.type).toBe('external-ai-agent');
    expect(res.body.agent.status).toBe('ACTIVE');
    expect(res.body.agent.scopes).toEqual(['project.read', 'project.write']);
    expect(res.body.agent.createdAt).toBeDefined();
    expect(res.body.requestId).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('2. Retrieves an existing agent by ID', async () => {
    const created = await agentRepository.create({
      id: 'agent-test-1',
      name: 'Test Agent',
      type: 'external-ai-agent',
      status: 'ACTIVE',
      scopes: ['data.read'],
      createdAt: new Date().toISOString()
    });

    const res = await request(app)
      .get(`/api/v1/agents/${created.id}`)
      .expect(200);

    expect(res.body.agent).toBeDefined();
    expect(res.body.agent.id).toBe('agent-test-1');
    expect(res.body.agent.name).toBe('Test Agent');
  });

  it('3. Lists all registered agents', async () => {
    await agentRepository.create({
      id: 'agent-1',
      name: 'Agent One',
      type: 'external-ai-agent',
      status: 'ACTIVE',
      scopes: ['read'],
      createdAt: new Date().toISOString()
    });
    await agentRepository.create({
      id: 'agent-2',
      name: 'Agent Two',
      type: 'external-ai-agent',
      status: 'ACTIVE',
      scopes: ['write'],
      createdAt: new Date().toISOString()
    });

    const res = await request(app)
      .get('/api/v1/agents')
      .expect(200);

    expect(res.body.agents).toHaveLength(2);
  });

  it('4. Rejects malformed agent registration payloads', async () => {
    // Missing name
    const res1 = await request(app)
      .post('/api/v1/agents')
      .send({ scopes: ['read'] })
      .expect(400);

    expect(res1.body.error).toBeDefined();
    expect(res1.body.error.code).toBe('VALIDATION_ERROR');

    // Missing scopes
    const res2 = await request(app)
      .post('/api/v1/agents')
      .send({ name: 'Invalid Agent' })
      .expect(400);

    expect(res2.body.error.code).toBe('VALIDATION_ERROR');

    // Empty name
    const res3 = await request(app)
      .post('/api/v1/agents')
      .send({ name: '   ', scopes: ['read'] })
      .expect(400);

    expect(res3.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Returns 404 for nonexistent agent', async () => {
    const res = await request(app)
      .get('/api/v1/agents/nonexistent-agent-id')
      .expect(404);

    expect(res.body.error.code).toBe('AGENT_NOT_FOUND');
  });
});
