-- HirePilot AI - Automatic read-only external discovery and source catalog
-- Catalog entries are recommendations only. Importing never approves, enables,
-- or grants real crawl permission to a source.

ALTER TABLE external_sources
ADD COLUMN IF NOT EXISTS auto_discovery_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS discovery_interval_minutes INTEGER DEFAULT 1440,
ADD COLUMN IF NOT EXISTS last_auto_discovery_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS next_discovery_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS auto_discovery_status VARCHAR(30),
ADD COLUMN IF NOT EXISTS auto_discovery_error TEXT,
ADD COLUMN IF NOT EXISTS source_category VARCHAR(80),
ADD COLUMN IF NOT EXISTS source_priority INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS source_region VARCHAR(80),
ADD COLUMN IF NOT EXISTS source_company_size VARCHAR(80),
ADD COLUMN IF NOT EXISTS source_tags TEXT;

UPDATE external_sources
SET auto_discovery_enabled = FALSE
WHERE auto_discovery_enabled IS NULL;

UPDATE external_sources
SET discovery_interval_minutes = 1440
WHERE discovery_interval_minutes IS NULL OR discovery_interval_minutes < 5;

CREATE INDEX IF NOT EXISTS idx_external_sources_auto_discovery_eligibility
ON external_sources (
  auto_discovery_enabled,
  is_enabled,
  trust_status,
  real_crawl_allowed,
  next_discovery_at,
  source_priority
);

CREATE INDEX IF NOT EXISTS idx_external_discovery_runs_source_status_created
ON external_discovery_runs(external_source_id, run_status, created_at DESC);

CREATE TABLE IF NOT EXISTS external_source_catalog (
  catalog_id SERIAL PRIMARY KEY,
  source_name VARCHAR(150) NOT NULL,
  source_key VARCHAR(150) UNIQUE NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  base_url TEXT NOT NULL,
  source_category VARCHAR(80),
  source_region VARCHAR(80),
  source_company_size VARCHAR(80),
  recommended_interval_minutes INTEGER DEFAULT 1440,
  safety_mode VARCHAR(50) DEFAULT 'manual_review',
  notes TEXT,
  is_seeded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_external_source_catalog_filters
ON external_source_catalog(source_category, source_region, source_name);

INSERT INTO external_source_catalog (
  source_name,
  source_key,
  source_type,
  base_url,
  source_category,
  source_region,
  source_company_size,
  recommended_interval_minutes,
  safety_mode,
  notes,
  is_seeded
)
VALUES
  (
    'Smart Working Solutions Careers',
    'smart_working_solutions_careers',
    'company_career_page',
    'https://jobs.lever.co/smart-working-solutions/',
    'ats_job_board',
    'Global / India',
    'Medium',
    1440,
    'manual_review',
    'Public Lever job board example. URL availability and page structure may change; review before importing.',
    TRUE
  ),
  (
    'Automattic Careers',
    'automattic_careers',
    'company_career_page',
    'https://automattic.com/work-with-us/',
    'remote_jobs',
    'Global',
    'Large',
    1440,
    'manual_review',
    'Public remote-first careers example. Validate site terms and URL stability before enabling.',
    TRUE
  ),
  (
    'GitLab Jobs',
    'gitlab_jobs',
    'company_career_page',
    'https://about.gitlab.com/jobs/all-jobs/',
    'remote_jobs',
    'Global',
    'Large',
    1440,
    'manual_review',
    'Public company careers example. Validate the current page and applicable terms before enabling.',
    TRUE
  ),
  (
    'Vercel Careers',
    'vercel_careers',
    'company_career_page',
    'https://vercel.com/careers',
    'company_careers',
    'Global',
    'Large',
    1440,
    'manual_review',
    'Public company careers example. The URL and rendered markup are not guaranteed to remain stable.',
    TRUE
  ),
  (
    'Stripe Greenhouse Job Board',
    'stripe_greenhouse_jobs',
    'job_board',
    'https://job-boards.greenhouse.io/stripe',
    'ats_job_board',
    'Global',
    'Large',
    1440,
    'manual_review',
    'Public Greenhouse board example. Import remains pending and disabled until explicit admin review.',
    TRUE
  ),
  (
    'Remote OK Developer Jobs',
    'remote_ok_developer_jobs',
    'job_board',
    'https://remoteok.com/remote-dev-jobs',
    'startup_jobs',
    'Global',
    'Mixed',
    1440,
    'manual_review',
    'Public remote-jobs example. Use conservative intervals and validate terms before enabling.',
    TRUE
  )
ON CONFLICT (source_key) DO NOTHING;
