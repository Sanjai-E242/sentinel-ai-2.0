import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { handleDatabaseError, DatabaseError } from '../src/database/errors.js';
import { SupabaseAgentRepository } from '../src/modules/agents/repository.js';
import { agentService } from '../src/modules/agents/service.js';

describe('Database Failure & Graceful Degradation', () => {
  it('maps connection errors to controlled 503 DatabaseError without crashing', () => {
    try {
      handleDatabaseError({ message: 'fetch failed', code: 'ECONNREFUSED' }, 'test.query');
      expect.fail('Should have thrown DatabaseError');
    } catch (err: unknown) {
      const dbErr = err as DatabaseError;
      expect(dbErr.statusCode).toBe(503);
      expect(dbErr.code).toBe('DATABASE_UNAVAILABLE');
      expect(dbErr.message).toContain('Database service temporarily unavailable');
    }
  });

  it('maps foreign key violations to controlled 400 error', () => {
    try {
      handleDatabaseError({ message: 'foreign key constraint fails', code: '23503' }, 'test.insert');
      expect.fail('Should have thrown DatabaseError');
    } catch (err: unknown) {
      const dbErr = err as DatabaseError;
      expect(dbErr.statusCode).toBe(400);
      expect(dbErr.code).toBe('FOREIGN_KEY_VIOLATION');
    }
  });

  it('maps duplicate key errors to controlled 409 error', () => {
    try {
      handleDatabaseError({ message: 'duplicate key value violates unique constraint', code: '23505' }, 'test.insert');
      expect.fail('Should have thrown DatabaseError');
    } catch (err: unknown) {
      const dbErr = err as DatabaseError;
      expect(dbErr.statusCode).toBe(409);
      expect(dbErr.code).toBe('DUPLICATE_RECORD');
    }
  });

  it('server returns controlled HTTP error when repository fails, but server remains alive and responsive', async () => {
    // Create a mock repository that simulates a catastrophic Supabase connection failure
    const failingRepo = {
      findById: async () => {
        handleDatabaseError(new Error('Connection terminated unexpectedly'), 'agents.findById');
        return null;
      },
      findAll: async () => {
        handleDatabaseError(new Error('Connection terminated unexpectedly'), 'agents.findAll');
        return [];
      },
      create: async () => {
        handleDatabaseError(new Error('Connection terminated unexpectedly'), 'agents.create');
        throw new Error('Unreachable');
      },
      update: async () => {
        handleDatabaseError(new Error('Connection terminated unexpectedly'), 'agents.update');
        throw new Error('Unreachable');
      }
    };

    // Swap repository on agentService
    agentService.setRepository(failingRepo);

    try {
      // 1. Send request that triggers database failure
      const res = await request(app).get('/api/v1/agents');

      // Controlled error, not unhandled crash!
      expect(res.status).toBe(503);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('DATABASE_UNAVAILABLE');
      expect(res.body.error.message).toContain('Database service temporarily unavailable');

      // 2. CRITICAL: Verify the server is still alive and responds to /api/health
      const healthRes = await request(app).get('/api/health');
      expect(healthRes.status).toBe(200);
      expect(healthRes.body.status).toBe('ok');
    } finally {
      // Restore repository
      const { agentRepository } = await import('../src/modules/agents/repository.js');
      agentService.setRepository(agentRepository);
    }
  });
});
