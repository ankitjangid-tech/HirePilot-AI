# HirePilot AI

HirePilot AI is a full-stack HR and AI recruitment platform. It supports candidate profiles, resume upload, ATS scoring, job matching, auto-apply workflows, pending-application fallback, recruiter job posting, applicant ranking, shortlist/reject actions, interview scheduling, dashboard notifications, and email-based password reset.

This repository is intended as a professional portfolio/commercial-grade project, not a basic tutorial demo.

## Tech Stack

```text
Frontend: React
Backend: Node.js + Express
Database: PostgreSQL
Authentication: JWT + bcrypt
Email: SMTP/Nodemailer in development
AI roadmap: Python/LangGraph + browser automation
```

## Main Modules

```text
Candidate
- Login and dashboard
- Resume upload and PDF parsing
- ATS score
- Profile completion
- Matched jobs
- Auto Apply
- My Applications
- Pending Applications fallback
- Notifications and interview details

Recruiter
- Login and dashboard
- Job posting
- View applicants
- Candidate ranking
- Shortlist / reject
- Schedule interview
- Email notification flow
```

## Local Setup

Create a backend environment file from the example:

```bash
cp backend/.env.example backend/.env
```

Then fill local values in `backend/.env`.

Start backend:

```bash
cd backend
node server.js
```

Start frontend:

```bash
cd frontend
npm start
```

## Privacy Notice

Do not commit real secrets, real resumes, reset tokens, or real user emails. Keep `backend/.env` private. Use `backend/.env.example` for documentation.

Before uploading to GitHub, review:

```text
docs/PRIVACY_CHECKLIST.md
```

## Demo Data Policy

Public demo data should use fake identities only:

```text
candidate.demo@hirepilot.ai
recruiter.demo@hirepilot.ai
Demo Candidate
Demo Recruiter
Demo Company
```

## Current Roadmap

```text
1. Stabilize current candidate/recruiter workflows
2. Improve notification quality and read/unread states
3. Upgrade recruiter applicant preview and ranking explanation
4. Add validation, tests, migrations, and API documentation
5. Move AI workflows into a separate Python/LangGraph agent layer
6. Add external job portal automation with manual fallback
7. Prepare deployment and production hardening
```
