-- HirePilot AI - Admin external discovery review foundation
-- Existing external jobs remain candidate-visible after this migration.

ALTER TABLE external_jobs
ADD COLUMN IF NOT EXISTS review_status VARCHAR(30) DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS review_notes TEXT,
ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE external_jobs
SET review_status = 'approved'
WHERE review_status IS NULL;

UPDATE external_jobs
SET discovered_at = COALESCE(discovered_at, created_at, CURRENT_TIMESTAMP)
WHERE discovered_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'external_jobs_review_status_check'
  ) THEN
    ALTER TABLE external_jobs
    ADD CONSTRAINT external_jobs_review_status_check
    CHECK (
      review_status IS NULL
      OR review_status IN ('pending_review', 'approved', 'hidden', 'rejected')
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_external_jobs_review_status
ON external_jobs(review_status, discovered_at DESC);
