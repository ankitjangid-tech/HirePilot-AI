CREATE TABLE IF NOT EXISTS ai_agent_runs (
  agent_run_id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(candidate_id) ON DELETE CASCADE,
  external_job_id INTEGER REFERENCES external_jobs(external_job_id) ON DELETE SET NULL,
  external_application_id INTEGER REFERENCES external_applications(external_application_id) ON DELETE SET NULL,
  agent_name VARCHAR(100) DEFAULT 'external_apply_orchestrator',
  run_type VARCHAR(80) NOT NULL DEFAULT 'external_apply',
  run_status VARCHAR(50) NOT NULL DEFAULT 'queued',
  source_platform VARCHAR(100),
  requested_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  approval_status VARCHAR(50) DEFAULT 'candidate_approved',
  current_step VARCHAR(120),
  summary TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_agent_run_steps (
  step_id SERIAL PRIMARY KEY,
  agent_run_id INTEGER REFERENCES ai_agent_runs(agent_run_id) ON DELETE CASCADE,
  step_name VARCHAR(120) NOT NULL,
  step_status VARCHAR(50) NOT NULL DEFAULT 'completed',
  step_order INTEGER DEFAULT 1,
  details TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_candidate
ON ai_agent_runs(candidate_id);

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_external_job
ON ai_agent_runs(external_job_id);

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_status
ON ai_agent_runs(run_status);

CREATE INDEX IF NOT EXISTS idx_ai_agent_run_steps_run
ON ai_agent_run_steps(agent_run_id);
