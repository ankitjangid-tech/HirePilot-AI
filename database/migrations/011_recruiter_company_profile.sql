-- HirePilot AI - Recruiter company profile and admin verification foundation

CREATE TABLE IF NOT EXISTS recruiter_companies (
  company_id SERIAL PRIMARY KEY,
  recruiter_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  company_name VARCHAR(150) NOT NULL,
  company_website TEXT,
  industry VARCHAR(100),
  company_size VARCHAR(50),
  headquarters_location VARCHAR(150),
  company_description TEXT,
  verification_status VARCHAR(30) DEFAULT 'pending',
  verification_notes TEXT,
  verified_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT recruiter_companies_recruiter_unique UNIQUE (recruiter_id),
  CONSTRAINT recruiter_companies_verification_status_check
    CHECK (
      verification_status IN (
        'pending',
        'verified',
        'rejected',
        'needs_review'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_recruiter_companies_verification_status
ON recruiter_companies(verification_status, updated_at DESC);
