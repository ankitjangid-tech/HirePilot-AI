-- HirePilot AI - Admin recruiter approval foundation
-- Existing recruiter accounts remain operational; new recruiter registrations
-- are explicitly created as pending by the backend.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS recruiter_status VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recruiter_status_reason TEXT,
ADD COLUMN IF NOT EXISTS recruiter_status_updated_at TIMESTAMP;

UPDATE users
SET recruiter_status = 'approved',
    recruiter_status_reason = NULL,
    recruiter_status_updated_at = COALESCE(
      recruiter_status_updated_at,
      CURRENT_TIMESTAMP
    )
WHERE role = 'recruiter'
AND recruiter_status IS NULL;

UPDATE users
SET recruiter_status = NULL,
    recruiter_status_reason = NULL,
    recruiter_status_updated_at = NULL
WHERE role <> 'recruiter'
AND (
  recruiter_status IS NOT NULL
  OR recruiter_status_reason IS NOT NULL
  OR recruiter_status_updated_at IS NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_recruiter_status_check'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_recruiter_status_check
    CHECK (
      recruiter_status IS NULL
      OR recruiter_status IN ('pending', 'approved', 'blocked')
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_recruiter_status
ON users(role, recruiter_status);
