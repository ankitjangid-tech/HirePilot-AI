CREATE TABLE IF NOT EXISTS external_jobs (
  external_job_id SERIAL PRIMARY KEY,
  job_title VARCHAR(150) NOT NULL,
  company_name VARCHAR(150) NOT NULL,
  source_platform VARCHAR(100) DEFAULT 'Company Career Page',
  job_url TEXT NOT NULL UNIQUE,
  required_skills TEXT,
  experience_required INTEGER DEFAULT 0,
  location VARCHAR(100),
  salary VARCHAR(50),
  apply_mode VARCHAR(40) DEFAULT 'manual_questions',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS external_applications (
  external_application_id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(candidate_id) ON DELETE CASCADE,
  external_job_id INTEGER REFERENCES external_jobs(external_job_id) ON DELETE CASCADE,
  application_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  failure_reason TEXT,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(candidate_id, external_job_id)
);

CREATE INDEX IF NOT EXISTS idx_external_applications_candidate
ON external_applications(candidate_id);

CREATE INDEX IF NOT EXISTS idx_external_applications_job
ON external_applications(external_job_id);

INSERT INTO external_jobs (
  job_title,
  company_name,
  source_platform,
  job_url,
  required_skills,
  experience_required,
  location,
  salary,
  apply_mode
)
VALUES
  (
    'AI Engineer Trainee',
    'NeuralHire Labs',
    'Company Career Page',
    'https://careers.neuralhire.example/jobs/ai-engineer-trainee',
    'Python,SQL,Machine Learning,AI',
    0,
    'Remote',
    '6 LPA',
    'easy_apply'
  ),
  (
    'Junior Full Stack Developer',
    'CodeBridge Systems',
    'LinkedIn Simulation',
    'https://linkedin.example/jobs/junior-full-stack-developer-questions',
    'React,JavaScript,HTML,CSS,Node.js',
    0,
    'Bangalore / Remote',
    '7 LPA',
    'manual_questions'
  ),
  (
    'Data Analyst Associate',
    'DataWorks Analytics',
    'Indeed Simulation',
    'https://indeed.example/jobs/data-analyst-associate',
    'Python,SQL,Excel,Power BI',
    0,
    'Jaipur',
    '5 LPA',
    'easy_apply'
  ),
  (
    'SQL Reporting Analyst',
    'CloudMetrics',
    'Company Career Page',
    'https://careers.cloudmetrics.example/jobs/sql-reporting-analyst-questions',
    'SQL,PostgreSQL,Excel,Dashboarding',
    0,
    'Remote',
    '6 LPA',
    'manual_questions'
  )
ON CONFLICT (job_url) DO UPDATE
SET
  job_title = EXCLUDED.job_title,
  company_name = EXCLUDED.company_name,
  source_platform = EXCLUDED.source_platform,
  required_skills = EXCLUDED.required_skills,
  experience_required = EXCLUDED.experience_required,
  location = EXCLUDED.location,
  salary = EXCLUDED.salary,
  apply_mode = EXCLUDED.apply_mode,
  is_active = TRUE,
  updated_at = CURRENT_TIMESTAMP;
