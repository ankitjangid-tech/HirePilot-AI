# HirePilot AI Privacy & Security Checklist

Use this checklist before GitHub upload, screenshots, demo video, portfolio sharing, or deployment.

## Must remove before GitHub

- [ ] `backend/.env`
- [ ] Any other `.env` or `*.env` file containing local/deployment values
- [ ] Any Gmail app password or SMTP password
- [ ] Any JWT secret
- [ ] Any real database password
- [ ] Any reset token copied from PostgreSQL
- [ ] Any real candidate/recruiter email address in code, screenshots, docs, or seed data
- [ ] Uploaded resumes from `backend/uploads/`
- [ ] Real resumes copied into any sample, test, documentation, or release directory
- [ ] Screenshots showing real email, token, password, or personal resume details
- [ ] Database dumps containing real users, resumes, emails, or passwords
- [ ] Log files, zip archives, CI artifacts, or release bundles containing private data

Ignoring a file does not remove it if Git already tracks it, and deleting it in a later commit does not erase it from history.

- [ ] Run `git ls-files` and confirm no environment file, upload, resume, dump, log, or archive is tracked
- [ ] Scan the current tree and full Git history with a trusted secret scanner
- [ ] Review issues, pull requests, actions logs, releases, and uploaded artifacts separately

## Safe demo data

Use demo identities for public testing:

```text
candidate.demo@hirepilot.ai
recruiter.demo@hirepilot.ai
noreply@hirepilot.ai
Demo Candidate
Demo Recruiter
Demo Company
```

Use fake passwords only in public docs:

```text
Candidate demo password: DemoCandidate@123
Recruiter demo password: DemoRecruiter@123
```

## Resume privacy

Candidate resumes can contain sensitive personal data such as phone number, email, address, education, and work history.

Before public demo:

- [ ] Use a synthetic demo resume
- [ ] Remove original PDFs from `backend/uploads/`
- [ ] Do not commit uploaded files
- [ ] Confirm screenshots use synthetic names, email addresses, phone numbers, locations, employment history, and education
- [ ] Confirm screenshots do not show browser storage, bearer tokens, reset links, terminal environment output, or database rows containing real people
- [ ] Check image metadata and filenames for personal information
- [ ] Add a retention/deletion policy before production launch

## Documentation safety

- [ ] Use placeholder credentials such as `candidate@example.com / password`
- [ ] Keep all environment examples placeholder-only
- [ ] Do not paste a real hostname, private IP, filesystem path, API key, token, password, or email credential into Markdown
- [ ] Do not include raw production logs, stack traces, database exports, or HTTP authorization headers
- [ ] Clearly label Crawl4AI as safe local raw-HTML discovery
- [ ] Clearly label Playwright as a safe dummy-portal flow
- [ ] Do not claim that real LinkedIn, Indeed, or company applications are submitted
- [ ] Do not claim production deployment is complete

## Email and reset-token safety

- [ ] Do not expose reset tokens in frontend logs
- [ ] Reset tokens should expire quickly
- [ ] Reset tokens should be cleared after successful password reset
- [ ] Use real email only for controlled testing
- [ ] Use a production email provider before launch
- [ ] Use a dedicated provider credential rather than a personal mailbox app password

If an app password, SMTP password, provider token, JWT secret, or database credential may have leaked:

- [ ] Revoke it immediately
- [ ] Generate a replacement credential
- [ ] Store the replacement only in a private local environment file or deployment secret manager
- [ ] Review provider/account access logs for misuse
- [ ] Remove the leaked value from Git history and public artifacts where necessary

Revocation and regeneration are mandatory. Removing the visible text from the latest commit is not sufficient.

## Before deployment

- [ ] Rotate any secret that was pasted into chat, screenshots, or uploaded zip files
- [ ] Use environment variables on the hosting platform
- [ ] Enable HTTPS
- [ ] Add rate limiting for login and forgot-password
- [ ] Add request validation
- [ ] Add centralized error handling
- [ ] Add database backups and logging
- [ ] Complete the checks in [`DEPLOYMENT_READINESS.md`](DEPLOYMENT_READINESS.md)

## Current reminder

Your local development project may contain real `.env` values and uploaded resume PDFs. Keep them local and private.

For public review, the safe default is: if data was not intentionally generated for the demo, do not publish it.
