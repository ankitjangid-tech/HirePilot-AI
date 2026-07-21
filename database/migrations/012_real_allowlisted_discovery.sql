-- HirePilot AI - Read-only allowlisted Crawl4AI discovery foundation
-- Real web discovery remains disabled until an admin explicitly approves,
-- enables, and marks an external source as allowed for read-only crawling.

ALTER TABLE external_sources
ADD COLUMN IF NOT EXISTS real_crawl_allowed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_discovery_run_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_discovery_status VARCHAR(30),
ADD COLUMN IF NOT EXISTS last_discovery_message TEXT;

-- Persist discovery provenance on external jobs so admin review and audit
-- records can distinguish allowlisted web discovery from demo discovery.
ALTER TABLE external_jobs
ADD COLUMN IF NOT EXISTS discovery_source VARCHAR(100);

CREATE TABLE IF NOT EXISTS external_discovery_runs (
  discovery_run_id SERIAL PRIMARY KEY,
  external_source_id INTEGER
    REFERENCES external_sources(external_source_id) ON DELETE SET NULL,
  requested_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  source_url TEXT NOT NULL,
  run_status VARCHAR(30) DEFAULT 'queued',
  discovered_count INTEGER DEFAULT 0,
  inserted_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  error_message TEXT,
  raw_summary JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT external_discovery_runs_status_check
    CHECK (run_status IN ('queued', 'running', 'completed', 'failed', 'blocked'))
);

CREATE INDEX IF NOT EXISTS idx_external_discovery_runs_source_created
ON external_discovery_runs(external_source_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_discovery_runs_status_created
ON external_discovery_runs(run_status, created_at DESC);

UPDATE external_sources
SET real_crawl_allowed = FALSE
WHERE real_crawl_allowed IS NULL;

-- The local raw-HTML demo keeps its existing safety mode. It does not need
-- real web crawl permission because it never contacts an external website.
UPDATE external_sources
SET real_crawl_allowed = FALSE
WHERE source_key = 'crawl4ai_demo';
