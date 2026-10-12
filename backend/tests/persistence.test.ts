import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  LocalAgentRepository,
  InMemoryAgentRepository
} from '../src/modules/agents/repository.js';
import {
  LocalSessionRepository,
  InMemorySessionRepository
} from '../src/modules/sessions/repository.js';
import {
  LocalActionEventRepository,
  InMemoryActionEventRepository
} from '../src/modules/actions/repository.js';
import {
  LocalAuditLogRepository,
  InMemoryAuditLogRepository
} from '../src/modules/audit/repository.js';
import { getLocalDataDir } from '../src/database/localStore.js';

describe('Repository Persistence & Survivability', () => {
  const dataDir = getLocalDataDir();
  const testAgentFile = path.join(dataDir, 'sentinel-agents.json');
  const testSessionFile = path.join(dataDir, 'sentinel-sessions.json');
  const testActionFile = path.join(dataDir, 'sentinel-actions.json');
  const testAuditFile = path.join(dataDir, 'sentinel-audit.json');

  beforeEach(() => {
    // Clean test files
    for (const f of [testAgentFile, testSessionFile, testActionFile, testAuditFile]) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch {}
      }
    }
  });

  afterEach(() => {
    for (const f of [testAgentFile, testSessionFile, testActionFile, testAuditFile]) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch {}
      }
    }
  });

  describe('In-Memory Repositories', () => {
    it('creates, retrieves, and lists agents', async () => {
      const repo = new InMemoryAgentRepository();
      const agent = {
        id: 'agent-persist-1',
        name: 'Persistent Agent',
        type: 'worker',
        status: 'ACTIVE' as const,
        scopes: ['data:read', 'data:write'],
        createdAt: new Date().toISOString()
      };

      await repo.create(agent);
      const retrieved = await repo.findById('agent-persist-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Persistent Agent');

      const all = await repo.findAll();
      expect(all.length).toBe(1);
    });

    it('creates and retrieves sessions', async () => {
      const repo = new InMemorySessionRepository();
      const session = {
        id: 'sess-persist-1',
        agentId: 'agent-persist-1',
        status: 'ACTIVE' as const,
        startedAt: new Date().toISOString(),
        currentRisk: 0,
        trajectoryDeviation: 0,
        actionCount: 0
      };

      await repo.create(session);
      const retrieved = await repo.findById('sess-persist-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.agentId).toBe('agent-persist-1');

      const byAgent = await repo.findByAgentId('agent-persist-1');
      expect(byAgent.length).toBe(1);
    });

    it('persists and retrieves action events', async () => {
      const repo = new InMemoryActionEventRepository();
      const event = {
        eventId: 'evt-persist-1',
        agentId: 'agent-persist-1',
        sessionId: 'sess-persist-1',
        timestamp: new Date().toISOString(),
        action: 'READ' as const,
        resource: 'db:table',
        resourceType: 'database',
        scope: 'data:read',
        sensitivity: 'LOW' as const,
        reversibility: 'REVERSIBLE' as const,
        authorization: 'AUTHORIZED' as const
      };

      await repo.create(event);
      const retrieved = await repo.findById('evt-persist-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.resource).toBe('db:table');
    });

    it('creates and filters audit log entries', async () => {
      const repo = new InMemoryAuditLogRepository();
      await repo.append({
        id: 'aud-1',
        eventType: 'AGENT_CREATED',
        entityType: 'agent',
        entityId: 'agent-1',
        actor: 'system',
        payload: { test: true },
        createdAt: new Date().toISOString()
      });

      const logs = await repo.findAll({ eventType: 'AGENT_CREATED' });
      expect(logs.length).toBe(1);
      expect(logs[0].id).toBe('aud-1');
    });
  });

  describe('Local Disk Repositories (Restart Survivability)', () => {
    it('persists agents across repository re-instantiation (simulating backend restart)', async () => {
      // 1. First instance writes to disk
      const repo1 = new LocalAgentRepository();
      await repo1.create({
        id: 'agent-restart-1',
        name: 'Surviving Agent',
        type: 'ai-worker',
        status: 'ACTIVE' as const,
        scopes: ['system:read'],
        createdAt: new Date().toISOString()
      });

      // 2. Second instance reads from disk (simulating fresh server start)
      const repo2 = new LocalAgentRepository();
      const surviving = await repo2.findById('agent-restart-1');
      expect(surviving).not.toBeNull();
      expect(surviving?.name).toBe('Surviving Agent');
      expect(surviving?.scopes).toEqual(['system:read']);
    });

    it('persists sessions and actions across repository re-instantiation', async () => {
      // Write session & action
      const sessionRepo1 = new LocalSessionRepository();
      await sessionRepo1.create({
        id: 'sess-survive-1',
        agentId: 'agent-survive-1',
        status: 'ACTIVE' as const,
        startedAt: new Date().toISOString(),
        currentRisk: 10,
        trajectoryDeviation: 0.1,
        actionCount: 1
      });

      const actionRepo1 = new LocalActionEventRepository();
      await actionRepo1.create({
        eventId: 'evt-survive-1',
        agentId: 'agent-survive-1',
        sessionId: 'sess-survive-1',
        timestamp: new Date().toISOString(),
        action: 'EXECUTE' as const,
        resource: 'script.py',
        resourceType: 'script',
        scope: 'system:exec',
        sensitivity: 'HIGH' as const,
        reversibility: 'REVERSIBLE' as const,
        authorization: 'AUTHORIZED' as const
      });

      // Fresh instances read from disk
      const sessionRepo2 = new LocalSessionRepository();
      const survivingSession = await sessionRepo2.findById('sess-survive-1');
      expect(survivingSession).not.toBeNull();
      expect(survivingSession?.id).toBe('sess-survive-1');

      const actionRepo2 = new LocalActionEventRepository();
      const survivingAction = await actionRepo2.findById('evt-survive-1');
      expect(survivingAction).not.toBeNull();
      expect(survivingAction?.action).toBe('EXECUTE');
    });

    it('persists audit trail append-only across re-instantiation', async () => {
      if (fs.existsSync(testAuditFile)) {
        try { fs.unlinkSync(testAuditFile); } catch {}
      }
      const auditRepo1 = new LocalAuditLogRepository();
      await auditRepo1.append({
        id: 'aud-survive-1',
        eventType: 'AGENT_CREATED',
        entityType: 'agent',
        entityId: 'agent-survive-1',
        actor: 'admin',
        payload: { created: true },
        createdAt: new Date().toISOString()
      });

      const auditRepo2 = new LocalAuditLogRepository();
      const logs = await auditRepo2.findAll();
      expect(logs.length).toBe(1);
      expect(logs[0].id).toBe('aud-survive-1');
    });
  });
});
