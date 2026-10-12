-- ============================================================
-- SENTINEL 2.0 — PHASE 4 DATABASE MIGRATION
-- Intervention Intelligence, Human Review Queue, and Counterfactuals
-- ============================================================

-- 1. INTERVENTIONS TABLE
CREATE TABLE IF NOT EXISTS interventions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  action_event_id TEXT NOT NULL REFERENCES action_events(id) ON DELETE CASCADE,
  intervention_window TEXT NOT NULL CHECK (intervention_window IN ('TOO_EARLY', 'OPTIMAL_WINDOW', 'TOO_LATE')),
  urgency TEXT NOT NULL CHECK (urgency IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  recommendation TEXT NOT NULL CHECK (recommendation IN ('ALLOW', 'MONITOR', 'WARN', 'CONFIRM', 'BLOCK')),
  current_risk NUMERIC NOT NULL DEFAULT 0,
  predicted_risk NUMERIC NOT NULL DEFAULT 0,
  intervention_cost TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (intervention_cost IN ('LOW', 'MEDIUM', 'HIGH')),
  explanation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interventions_session_id ON interventions(session_id);
CREATE INDEX IF NOT EXISTS idx_interventions_status ON interventions(status);

-- 2. HUMAN DECISIONS AUDIT TABLE
CREATE TABLE IF NOT EXISTS human_decisions (
  id TEXT PRIMARY KEY,
  intervention_id TEXT NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('ALLOW_ONCE', 'DENY', 'REVOKE_SESSION')),
  reviewer_id TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_human_decisions_intervention_id ON human_decisions(intervention_id);

-- 3. COUNTERFACTUAL ANALYSES TABLE
CREATE TABLE IF NOT EXISTS counterfactuals (
  id TEXT PRIMARY KEY,
  intervention_id TEXT NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
  early_risk TEXT NOT NULL,
  recommended_risk TEXT NOT NULL,
  late_risk TEXT NOT NULL,
  early_cost TEXT NOT NULL,
  recommended_cost TEXT NOT NULL,
  late_cost TEXT NOT NULL,
  optimal_rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
