CREATE TABLE IF NOT EXISTS agent_attempt_logs (
  agent_attempt_id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(candidate_id) ON DELETE CASCADE,
  external_job_id INTEGER REFERENCES external_jobs(external_job_id) ON DELETE SET NULL,
  external_application_id INTEGER REFERENCES external_applications(external_application_id) ON DELETE SET NULL,
  agent_name VARCHAR(100) NOT NULL DEFAULT 'external_apply_agent',
  action_type VARCHAR(80) NOT NULL,
  attempt_status VARCHAR(60) NOT NULL,
  source_platform VARCHAR(100),
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_attempt_logs_candidate
ON agent_attempt_logs(candidate_id);

CREATE INDEX IF NOT EXISTS idx_agent_attempt_logs_external_job
ON agent_attempt_logs(external_job_id);

CREATE INDEX IF NOT EXISTS idx_agent_attempt_logs_external_application
ON agent_attempt_logs(external_application_id);

CREATE INDEX IF NOT EXISTS idx_agent_attempt_logs_created_at
ON agent_attempt_logs(created_at DESC);
