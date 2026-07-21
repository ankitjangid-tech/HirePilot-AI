# HirePilot AI Features

This document describes the current local-development feature set. “Safe demo” features are intentionally constrained simulations and should not be presented as real external-portal integrations.

## Candidate Workspace

### Profile and resume

- Candidate profile creation and updates
- Contact, location, education, project, certification, and professional-summary fields
- PDF resume upload and parsing
- Secure resume view and download actions
- Profile completion indicators and missing-field guidance
- ATS score display when available

### Job discovery and trust

- Internal matched jobs with match scores
- Approved external matched jobs only
- Required-skill and location context
- Verified Employer, Verification Pending, and Unverified Employer indicators
- Reviewed by HirePilot badge for approved external jobs
- Safe demo and simulated-source labels
- External source preview without automatically opening a real website

### Applications

- Internal application workflow
- Auto Apply workflow for supported internal matching
- External Apply with HirePilot workflow
- Application Control Center summary
- Internal, External, and Pending Manual sections
- All, Internal, External, and Pending Manual filters
- External statuses for applied, failed, cancelled, pending manual action, and manually completed outcomes
- Candidate-controlled manual completion confirmation
- Protection against duplicate application records through backend constraints/workflows

### AI Agent Timeline

- Latest external agent runs first
- All, Active, Completed, and Failed filters
- Live progress polling for active runs
- Ordered run steps and current-step context
- Friendly failure summaries
- Expandable technical details for failed runs
- Retry and cancel controls where the run state permits them
- Development-only safe browser test and safe dummy reset controls

### Interviews and notifications

- Upcoming interview view
- Notification Center with unread count
- Mark one or all notifications read
- Duplicate-notification cleanup
- Shortlist, selection, rejection, and interview event context

## Recruiter Workspace

### Account governance

- Recruiter-specific JWT/RBAC access
- Pending, approved, and blocked account notices
- Job publishing restricted to Admin-approved recruiters
- Clear server feedback when posting is unavailable

### Company profile

- One company profile per Recruiter
- Company name, website, industry, size, headquarters, and description
- Pending, verified, rejected, and needs-review states
- Admin verification notes shown to the Recruiter
- Verified-company trust status near company and job views

### Job management

- Internal job posting
- Company, title, skills, experience, salary, location, and description fields
- Recruiter's own job list
- Employer trust badge on posted jobs
- Job selection for applicant and interview workflows

### Applicant review

- Applicants grouped by selected job
- Candidate ranking score and ATS context
- Experience, location, profile, education, projects, and skills preview
- Matched and missing skill explanation when available
- Resume view and download
- Shortlist and reject controls

### Interviews

- Interview scheduling for shortlisted Candidates
- Rescheduling and cancellation
- Interview state shown alongside applicant status
- Candidate notification creation through backend workflows

## Admin Control Panel

### Overview

- Recruiter approval counts
- Company verification counts
- External-source count
- External-job review counts
- Clear separation between access, employer trust, and discovery governance

### Recruiter approval

- Recruiter account list with name, email, status, and created date
- Approve and block controls
- Existing Recruiters preserved as approved by the approval-system migration
- New Recruiters default to pending

### Company verification

- Recruiter and company identity context
- Website, industry, location, status, and verification notes
- Verify, Reject, Mark Needs Review, and Mark Pending controls
- Independent Save Notes action with feedback

### External source allowlist

- Source name, unique key, type, base reference, safety mode, and notes
- Enabled/disabled and pending/approved/blocked states
- Create-source form
- Enable, Disable, Approve, Block, and Save Notes controls
- Safe Crawl4AI demo source seeded as an explicitly approved local source

### Discovery operations

- Admin-only Crawl4AI demo discovery trigger
- Development-only UI visibility
- Source allowlist enforcement before execution
- Clear discovered, inserted, and updated counts
- Automatic review-list refresh after completion

### External-job review

- Full discovered-job review list
- Pending, approved, hidden, and rejected counts/statuses
- Review notes
- Approve, Hide, Reject, and Mark Pending actions
- Candidate visibility restricted to approved or backward-compatible null review states

## Backend platform features

- JWT verification middleware
- Role authorization middleware
- Recruiter approval middleware for job publishing
- PostgreSQL persistence
- Password hashing with bcrypt
- Password-reset workflow foundation
- Resume upload and PDF parsing
- Candidate matching and applicant ranking endpoints
- Interview and notification APIs
- Candidate-scoped external applications and agent runs
- Admin-scoped governance APIs

## AI Worker

- FastAPI service with `/health`
- PostgreSQL connectivity reporting
- Playwright availability reporting
- Crawl4AI availability and safe-mode reporting
- Queue statistics and queued-run claiming foundation
- Safe candidate payload normalization with fallbacks
- Run and step status persistence
- Isolated child-process execution for Windows browser compatibility

## External automation foundation

### Supported workflow modes

- `easy_apply` — simulated supported flow
- `manual_questions` — candidate manual fallback
- `safe_browser_apply` — safe local Playwright dummy flow

### Crawl4AI safe demo

- Hardcoded raw local HTML with three deterministic job cards
- Structured extraction into existing external-job columns
- `crawl4ai-demo://` non-web references
- Backend payload validation
- Upsert behavior to reduce duplicate discovery records
- Admin moderation before Candidate visibility

### Playwright safe dummy apply

- Safe Dummy Frontend Engineer test record
- Local dummy form interaction
- No real login
- No real external website
- No real form submission
- Candidate-specific development reset without deleting historical agent runs

### Manual fallback

- Pending/manual status when automation cannot safely complete
- Reason or manual-action note shown to the Candidate
- Explicit Candidate completion action
- Auditable run history retained separately from application state

## Current limitations

- No production deployment is included.
- No live LinkedIn, Indeed, job-board, or company-career-page crawling is implemented.
- No real external application submission is implemented.
- Company verification does not yet collect or validate legal documents.
- Email delivery requires local SMTP configuration and further production hardening.
- Automated end-to-end and integration test coverage is not yet comprehensive.
- The numbered migrations extend an existing core schema rather than providing a complete blank-database bootstrap.
