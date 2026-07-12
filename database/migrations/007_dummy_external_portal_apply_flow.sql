-- HirePilot AI - Dummy External Portal Apply Flow V1
-- Adds a safe local/dummy external job that can be used to test Playwright apply flow.
-- This does not connect to LinkedIn, Indeed, or any real company career page.

INSERT INTO external_jobs (
  job_title,
  company_name,
  source_platform,
  job_url,
  required_skills,
  experience_required,
  location,
  salary,
  apply_mode,
  is_active
)
VALUES (
  'Safe Dummy Frontend Engineer',
  'HirePilot Demo Portal',
  'HirePilot Safe Dummy Portal',
  'https://hirepilot.local/dummy/frontend-engineer',
  'React,JavaScript,HTML,CSS',
  0,
  'Jaipur / Remote',
  '6 LPA',
  'safe_browser_apply',
  TRUE
)
ON CONFLICT (job_url) DO UPDATE
SET job_title = EXCLUDED.job_title,
    company_name = EXCLUDED.company_name,
    source_platform = EXCLUDED.source_platform,
    required_skills = EXCLUDED.required_skills,
    experience_required = EXCLUDED.experience_required,
    location = EXCLUDED.location,
    salary = EXCLUDED.salary,
    apply_mode = EXCLUDED.apply_mode,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;
