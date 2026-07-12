-- Candidate Full Profile Upgrade
-- Safe migration: adds optional professional/contact profile fields.
-- Existing profile completion logic remains unchanged.

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30),
ADD COLUMN IF NOT EXISTS current_location VARCHAR(120),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS github_url TEXT,
ADD COLUMN IF NOT EXISTS portfolio_url TEXT,
ADD COLUMN IF NOT EXISTS education TEXT,
ADD COLUMN IF NOT EXISTS projects TEXT,
ADD COLUMN IF NOT EXISTS certifications TEXT,
ADD COLUMN IF NOT EXISTS professional_summary TEXT,
ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE candidates
SET current_location = preferred_location
WHERE current_location IS NULL
AND preferred_location IS NOT NULL;
