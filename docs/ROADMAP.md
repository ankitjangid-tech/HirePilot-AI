# HirePilot AI Roadmap

This roadmap separates working local foundations from active hardening and future product work. Planned items are not claims of current functionality or committed delivery dates.

## Completed foundations

### Role-based workspaces

- Candidate Workspace tabs and overview
- Recruiter Workspace tabs and overview
- Admin Control Panel tabs and overview
- JWT authentication, role redirects, and backend RBAC
- Loading, empty-state, responsive, and wrong-role access polish

### Candidate experience

- Profile and resume workflow
- ATS score and profile completion
- Internal and approved-external matching views
- Internal and external application tracking
- Application Control Center and pending manual actions
- Interviews and Notification Center
- AI Agent Timeline with filtering, retry, cancel, and technical-detail controls

### Recruiter experience

- Admin-approved Recruiter posting gate
- Company profile
- Job posting and own-job view
- Applicant ranking and candidate preview
- Shortlist and rejection decisions
- Resume view/download
- Interview schedule, reschedule, and cancel workflows

### Admin governance

- Recruiter approval and blocking
- Recruiter company verification and notes
- External-source allowlist
- Admin-only discovery operation
- External-job review and Candidate visibility controls
- Verified Employer and Reviewed by HirePilot trust UI

### Safe automation foundations

- External application modes and manual fallback
- Persistent agent runs, ordered steps, queue metadata, and attempt logs
- Playwright safe dummy browser-apply test
- Windows child-process workaround for browser automation
- Crawl4AI raw local HTML discovery with three deterministic demo jobs
- Development-only safe dummy application reset while retaining run history

## In progress / hardening priorities

- Automated unit, API integration, and authenticated end-to-end tests
- Complete clean-database bootstrap schema and repeatable seed tooling
- Central request validation and normalized API error responses
- Configuration-driven frontend/backend URLs
- Production-quality authentication session handling
- Login and password-reset rate limiting
- Structured application and worker logging
- Background-worker lifecycle and queue recovery tests
- Accessibility review across tabs, modals, status messages, and keyboard flows
- Demo data reset and repeatable presentation tooling
- Email template, delivery, retry, and provider abstraction hardening

## Planned

### Real allowlisted external portal support

Potential support for explicitly approved sources only, subject to:

- written source authorization and terms review;
- legal, privacy, and security review;
- robots and rate-limit compliance where applicable;
- per-source adapters instead of unrestricted crawling;
- Candidate consent and clear manual checkpoints;
- credential isolation and secret management;
- anti-duplication, monitoring, kill switches, and audit logs;
- sandbox and staging validation before any production use.

This does not imply planned support for bypassing portal restrictions. LinkedIn, Indeed, and company sites are not currently crawled or applied to by HirePilot.

### LangGraph orchestration

- Explicit workflow graph for discovery, matching, application, and fallback states
- Durable checkpoints and resumable tasks
- Human-in-the-loop approval nodes
- Policy and source-safety guards
- Tool-level tracing and run evaluation
- Idempotent retry and compensation strategies

### Production deployment

- Containerized services
- Managed PostgreSQL and migration pipeline
- Secure environment and secret storage
- HTTPS, restricted CORS, security headers, and reverse proxy
- Worker process management and autoscaling policy
- Central logs, metrics, tracing, and alerts
- Backup, restore, retention, and incident procedures
- Staging and production CI/CD gates

Production deployment is not complete in the current repository.

### Email notification hardening

- Transactional email provider integration
- Verified sender domains
- Queued delivery and retries
- Bounce and complaint handling
- Template versioning
- User notification preferences
- Delivery observability and privacy-safe logs

### Real company verification documents

- Secure document submission
- Document type and expiry tracking
- Admin review audit trail
- Encryption and strict access control
- Retention/deletion policies
- Re-verification and appeal workflows

The current company verification status is an Admin-managed foundation and does not validate legal documents.

### Advanced analytics

- Candidate funnel and application conversion metrics
- Recruiter time-to-review and time-to-hire metrics
- Source quality and moderation metrics
- Interview conversion reporting
- Agent success, fallback, and failure analysis
- Fairness, bias, and ranking-quality evaluation
- Role-scoped exports and privacy controls

## Longer-term quality goals

- Formal API documentation and versioning
- Comprehensive threat modeling
- Data minimization and configurable retention
- Fine-grained Admin permissions
- Multi-tenant organization support
- Internationalization and timezone-aware scheduling
- Resume parsing evaluation across document formats
- Explainable matching and ranking improvements
- Governance reports for source, company, and agent decisions

## Non-goals for the current demo

- Scraping unrestricted public websites
- Logging into real job boards
- Circumventing anti-bot or access controls
- Submitting real external applications
- Treating Admin status selection as legal company verification
- Claiming production readiness without the hardening work above
