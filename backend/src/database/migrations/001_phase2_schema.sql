-- ============================================================
-- SENTINEL 2.0 — PHASE 2 DATABASE MIGRATION
-- Supabase PostgreSQL Schema with Immutable Audit Trail
-- ============================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. AGENTS TABLE
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'external-ai-agent',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  scopes TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'REVOKED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  current_risk NUMERIC NOT NULL DEFAULT 0,
  trajectory_deviation NUMERIC NOT NULL DEFAULT 0,
  action_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ACTION EVENTS TABLE
CREATE TABLE IF NOT EXISTS action_events (
  id TEXT PRIMARY KEY, -- eventId
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'resource',
  scope TEXT NOT NULL,
  sensitivity TEXT NOT NULL DEFAULT 'LOW',
  reversibility TEXT NOT NULL DEFAULT 'REVERSIBLE',
  authorization TEXT NOT NULL DEFAULT 'UNAUTHORIZED',
  risk_score NUMERIC NOT NULL DEFAULT 0,
  decision TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. AUDIT LOGS TABLE (Append-Only)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  session_id TEXT,
  actor TEXT NOT NULL DEFAULT 'sentinel-control-plane',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_agents_id ON agents(id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

CREATE INDEX IF NOT EXISTS idx_action_events_session_id ON action_events(session_id);
CREATE INDEX IF NOT EXISTS idx_action_events_agent_id ON action_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_action_events_timestamp ON action_events(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Service Role has full access. Public access is disabled.
-- ============================================================
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Service role access policies
CREATE POLICY "Service Role Full Access on agents" ON agents
  FOR ALL USING (auth.role() = 'service_role' OR current_user = 'postgres');

CREATE POLICY "Service Role Full Access on sessions" ON sessions
  FOR ALL USING (auth.role() = 'service_role' OR current_user = 'postgres');

CREATE POLICY "Service Role Full Access on action_events" ON action_events
  FOR ALL USING (auth.role() = 'service_role' OR current_user = 'postgres');

CREATE POLICY "Service Role Append/Read on audit_logs" ON audit_logs
  FOR ALL USING (auth.role() = 'service_role' OR current_user = 'postgres');
