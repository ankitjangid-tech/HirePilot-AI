# HirePilot AI Privacy & Security Checklist

Use this checklist before GitHub upload, screenshots, demo video, portfolio sharing, or deployment.

## Must remove before GitHub

- [ ] `backend/.env`
- [ ] Any Gmail app password or SMTP password
- [ ] Any JWT secret
- [ ] Any real database password
- [ ] Any reset token copied from PostgreSQL
- [ ] Any real candidate/recruiter email address in code, screenshots, docs, or seed data
- [ ] Uploaded resumes from `backend/uploads/`
- [ ] Screenshots showing real email, token, password, or personal resume details
- [ ] Database dumps containing real users, resumes, emails, or passwords

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
- [ ] Add a retention/deletion policy before production launch

## Email and reset-token safety

- [ ] Do not expose reset tokens in frontend logs
- [ ] Reset tokens should expire quickly
- [ ] Reset tokens should be cleared after successful password reset
- [ ] Use real email only for controlled testing
- [ ] Use a production email provider before launch

## Before deployment

- [ ] Rotate any secret that was pasted into chat, screenshots, or uploaded zip files
- [ ] Use environment variables on the hosting platform
- [ ] Enable HTTPS
- [ ] Add rate limiting for login and forgot-password
- [ ] Add request validation
- [ ] Add centralized error handling
- [ ] Add database backups and logging

## Current reminder

Your local development project may contain real `.env` values and uploaded resume PDFs. Keep them local and private.
