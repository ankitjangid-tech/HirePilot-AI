-- HirePilot AI - AI Agent Queue + Live Progress Foundation
-- Adds safe queue/worker tracking columns to existing ai_agent_runs table.

ALTER TABLE ai_agent_runs
ADD COLUMN IF NOT EXISTS queue_priority INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS locked_by VARCHAR(120),
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS queue_error TEXT;

UPDATE ai_agent_runs
SET queue_priority = COALESCE(queue_priority, 5),
    attempt_count = COALESCE(attempt_count, 0),
    max_attempts = COALESCE(max_attempts, 3),
    next_attempt_at = COALESCE(next_attempt_at, created_at)
WHERE queue_priority IS NULL
   OR attempt_count IS NULL
   OR max_attempts IS NULL
   OR next_attempt_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_queue_status
ON ai_agent_runs (run_status, next_attempt_at, queue_priority);

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_locked
ON ai_agent_runs (locked_by, locked_at);

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_live_candidate
ON ai_agent_runs (candidate_id, run_status, updated_at DESC);
