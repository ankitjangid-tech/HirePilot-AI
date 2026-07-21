# HirePilot AI Deployment Readiness

## Current classification

**Ready for:** controlled local development, portfolio review, and a synthetic-data demonstration.

**Not yet ready for:** production deployment, real Candidate or Recruiter data, real external-portal crawling, or real external application submission.

This document is a release-readiness checklist, not a claim that the platform has already been deployed or security-certified.

## What is ready

- Candidate, Recruiter, and Admin role-specific workspaces
- JWT verification and backend role checks
- Recruiter approval enforcement for job posting
- Recruiter company profile and Admin verification foundation
- Internal jobs, applications, applicant review, interviews, and notifications
- External-source allowlist and external-job review controls
- Candidate-visible trust badges
- Persistent agent runs, steps, statuses, and manual fallback records
- Crawl4AI raw local HTML demo discovery
- Playwright safe dummy portal automation
- Placeholder-only environment example
- Incremental database migrations `001–011`
- Local stack health check and E2E presentation checklist
- Public-repository ignore rules for secrets, uploads, dependencies, builds, logs, and archives

## Demo/local-only components

| Component | Current scope | Production work required |
| --- | --- | --- |
| React configuration | Local API URLs | Environment-driven API URL and deployment build configuration |
| Express server | Local port and permissive development CORS | Configurable port, restricted CORS, proxy/security configuration |
| PostgreSQL setup | Existing core schema plus incremental migrations | Complete baseline schema, automated migration pipeline, backup/restore testing |
| JWT session | Development authentication foundation | Session strategy review, secure storage, rotation/revocation policy |
| Password reset email | Local SMTP/Nodemailer foundation | Transactional provider, verified sender, rate limits, delivery monitoring |
| Resume storage | Local uploads | Private object storage, malware scanning, authorization, retention/deletion |
| Crawl4AI | Hardcoded raw local demo HTML | No real source support until explicit authorization and safety review |
| Playwright | Safe dummy portal only | No real submission until portal-specific approval, policy, and security work |
| Agent queue | Database-backed foundation | Managed worker lifecycle, concurrency, retries, idempotency, monitoring |
| Observability | Development terminal logs and timeline | Centralized structured logs, metrics, traces, alerts, and redaction |

## Safe demo limitations

- Crawl4AI builds and processes local raw HTML containing deterministic demo jobs.
- Crawl4AI does not crawl LinkedIn, Indeed, company career pages, or any real website.
- Playwright interacts with the HirePilot safe dummy flow only.
- The project does not log in to or submit applications through real job portals.
- Simulated LinkedIn and Indeed records are demonstration data, not live integrations.
- Company verification is an Admin-managed trust status; it is not legal-document verification.
- The local health check performs unauthenticated GET requests to localhost and does not validate every role workflow.
- Synthetic accounts and resumes must be used in public screenshots and recordings.

## Environment variables

Start from `backend/.env.example`. Store real deployment values in a managed secret store, never in Git.

| Variable | Purpose | Readiness note |
| --- | --- | --- |
| `DB_HOST` | PostgreSQL host | Use a private managed-database endpoint in production |
| `DB_PORT` | PostgreSQL port | Normally `5432`; restrict network access |
| `DB_NAME` | Database name | Use separate development, staging, and production databases |
| `DB_USER` | Database user | Use least privilege; avoid a superuser application account |
| `DB_PASSWORD` | Database credential | Secret store only; rotate regularly |
| `JWT_SECRET` | JWT signature secret | Generate a high-entropy secret; support rotation before production |
| `EMAIL_USER` | SMTP/provider identity | Use a verified transactional sender |
| `EMAIL_PASS` | SMTP password/provider credential | Secret store only; never an exposed personal app password |
| `FRONTEND_URL` | Password-reset link origin | Set the exact HTTPS frontend origin |
| `AI_WORKER_ENABLED` | Enables backend worker calls | Keep disabled until the worker is deployed and protected |
| `AI_WORKER_URL` | FastAPI worker base URL | Use private service networking and authentication before production |
| `AI_WORKER_TIMEOUT_MS` | Worker operation timeout | Tune and monitor by operation |
| `AI_WORKER_HEALTH_TIMEOUT_MS` | Worker health timeout | Keep short enough for API responsiveness |
| `AI_AGENT_QUEUE_ENABLED` | Enables queued external runs | Enable only with a supervised worker process |

Additional current development settings include `PORT`, `JWT_EXPIRES_IN`, `RESET_TOKEN_EXPIRES_MINUTES`, and `NODE_ENV`.

### Environment rules

- Do not commit `.env`, `*.env`, service-specific `.env`, or platform-exported secret files.
- Do not put secrets in React environment variables; browser bundles are public.
- Do not paste environment values into issues, pull requests, CI logs, screenshots, or demo recordings.
- Use different secrets for development, staging, and production.
- Rotate any value that has appeared in a public location, even if it was later deleted.

## Database migration checklist

The current numbered migrations are incremental and assume the original core schema already exists.

- [ ] Provision a clean staging database.
- [ ] Import or formalize the core schema for `users`, `candidates`, `jobs`, `applications`, `interviews`, and `notifications`.
- [ ] Back up the target database before migration.
- [ ] Apply migrations `001` through `011` in filename order.
- [ ] Stop and investigate every PostgreSQL error; do not skip a failed migration.
- [ ] Confirm constraints and indexes were created.
- [ ] Confirm existing Recruiters retain the intended approval status.
- [ ] Confirm existing external jobs retain the intended candidate visibility.
- [ ] Confirm the safe Crawl4AI source seed exists only where demo behavior is desired.
- [ ] Test rollback/restore using a disposable environment.
- [ ] Add an automated migration job with an auditable release record.
- [ ] Create a complete blank-database bootstrap before claiming repeatable production provisioning.

## Production deployment checklist

### Application and network

- [ ] Deploy separate frontend, API, worker, and PostgreSQL services.
- [ ] Use HTTPS everywhere and redirect HTTP to HTTPS.
- [ ] Restrict CORS to approved frontend origins.
- [ ] Put the API and worker behind appropriate private networking or authenticated service-to-service access.
- [ ] Configure production API/worker URLs through environment-aware deployment settings.
- [ ] Add health, readiness, and graceful-shutdown behavior suitable for the hosting platform.
- [ ] Define resource, timeout, concurrency, and autoscaling limits.

### Authentication and API security

- [ ] Review browser token storage and session-expiration behavior.
- [ ] Add rate limiting to login, registration, forgot-password, reset-password, discovery, and automation endpoints.
- [ ] Add centralized request validation and payload-size limits.
- [ ] Add security headers and a restrictive Content Security Policy.
- [ ] Standardize safe error responses without stack traces or database detail.
- [ ] Add audit events for Admin and high-impact Recruiter actions.
- [ ] Test horizontal and vertical authorization for every protected resource.

### Data and privacy

- [ ] Use encrypted managed PostgreSQL with private network access.
- [ ] Configure automated backups, retention, restore drills, and point-in-time recovery.
- [ ] Move resumes to private object storage with short-lived authorized access.
- [ ] Add file-type verification, size limits, and malware scanning.
- [ ] Define Candidate data, resume, application, notification, and audit-log retention policies.
- [ ] Implement account/data deletion and privacy-request procedures.
- [ ] Use only synthetic data in staging demos unless explicit consent and controls exist.

### Operations and quality

- [ ] Add unit, integration, migration, security, and authenticated E2E tests.
- [ ] Add CI checks for lint, build, tests, dependency review, and secret scanning.
- [ ] Add structured logs with personal-data and secret redaction.
- [ ] Add metrics and alerts for API errors, worker failures, queue depth, email failures, and database health.
- [ ] Define incident response, ownership, support, and rollback procedures.
- [ ] Run dependency and container vulnerability scanning.
- [ ] Complete a threat model and production security review.

## Security checklist for a public repository

- [ ] `git status --ignored` confirms real environment files, uploads, builds, virtual environments, logs, and archives are ignored.
- [ ] `git ls-files` contains no real `.env`, upload, resume, database dump, log, or archive.
- [ ] Current files and full Git history are scanned with a trusted secret scanner.
- [ ] Any secret ever committed is revoked and regenerated; deleting a file is not sufficient.
- [ ] Documentation contains placeholders only.
- [ ] Screenshots contain synthetic identities and no tokens, browser storage, terminal secrets, or personal data.
- [ ] Issues, pull requests, releases, CI artifacts, and zip archives are checked separately.
- [ ] Dependency advisories and licenses are reviewed.

## Email and app-password warning

Never commit or publish an SMTP password, Gmail/Outlook app password, API key, or transactional-email token. A masked screenshot or deleted commit does not make an exposed credential safe.

If an email credential may have been exposed:

1. Revoke it immediately at the email/provider account.
2. Generate a new credential.
3. Store the replacement only in the deployment secret manager or private local `.env`.
4. Review provider access logs and recent sending activity.
5. Remove the value from Git history if necessary, while treating rotation as mandatory.

Use a dedicated transactional provider and verified sender domain before production. Do not use a personal mailbox for a public deployment.

## External automation safety warning

Do not repoint the current Crawl4AI or Playwright demo flows at a real portal. Real allowlisted support requires, at minimum:

- explicit source authorization and terms review;
- portal-specific adapters and rate limits;
- Candidate consent and human approval checkpoints;
- credential isolation and service-to-service authentication;
- idempotency, duplicate prevention, monitoring, and a kill switch;
- legal, privacy, abuse, and security review;
- sandbox/staging validation and documented operational ownership.

The current project does not submit real LinkedIn, Indeed, or company applications.

## Release decision

Before a public GitHub demo, complete [PRIVACY_CHECKLIST.md](PRIVACY_CHECKLIST.md) and [E2E_DEMO_CHECKLIST.md](E2E_DEMO_CHECKLIST.md).

Before production deployment, every applicable production checklist item above should be completed or formally risk-accepted. Until then, describe HirePilot AI as a local demo and development foundation—not a production-deployed recruitment service.
