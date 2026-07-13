-- HirePilot AI - Admin external discovery source allowlist foundation
-- Discovery sources are disabled and pending by default unless explicitly seeded.

CREATE TABLE IF NOT EXISTS external_sources (
  external_source_id SERIAL PRIMARY KEY,
  source_name VARCHAR(150) NOT NULL,
  source_key VARCHAR(150) UNIQUE NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  base_url TEXT,
  is_enabled BOOLEAN DEFAULT FALSE,
  trust_status VARCHAR(30) DEFAULT 'pending',
  safety_mode VARCHAR(50) DEFAULT 'manual_review',
  notes TEXT,
  created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT external_sources_source_type_check
    CHECK (
      source_type IN (
        'demo_raw_html',
        'simulated_platform',
        'company_career_page',
        'job_board'
      )
    ),
  CONSTRAINT external_sources_trust_status_check
    CHECK (trust_status IN ('pending', 'approved', 'blocked'))
);

CREATE INDEX IF NOT EXISTS idx_external_sources_enabled_trust
ON external_sources(is_enabled, trust_status, source_key);

INSERT INTO external_sources (
  source_name,
  source_key,
  source_type,
  base_url,
  is_enabled,
  trust_status,
  safety_mode,
  notes
)
VALUES (
  'Crawl4AI Demo Discovery',
  'crawl4ai_demo',
  'demo_raw_html',
  'crawl4ai-demo://safe-raw-html',
  TRUE,
  'approved',
  'safe_raw_html_only',
  'Safe raw local demo HTML only. No external website is contacted.'
)
ON CONFLICT (source_key) DO NOTHING;
