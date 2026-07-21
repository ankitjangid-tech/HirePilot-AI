# HirePilot AI Local Setup Guide

This guide prepares HirePilot AI for local development and a controlled demo. It uses placeholders only. Do not copy real credentials, app passwords, private database values, or production secrets into documentation or source control.

## 1. Prerequisites

Install:

- **Node.js** with npm
- **Python 3.10+** with `pip`
- **PostgreSQL** with the `psql` client
- **Git**

Useful version checks:

```powershell
node --version
npm --version
python --version
psql --version
```

Default local ports:

| Service | Port |
| --- | ---: |
| React frontend | `3000` |
| Express backend | `5000` |
| FastAPI worker | `8000` |
| PostgreSQL | `5432` |

## 2. Install JavaScript dependencies

Backend dependencies are currently declared by the repository-root `package.json`.

```powershell
# From the repository root
npm install

cd frontend
npm install
cd ..
```

Do not commit generated dependency directories or local build output.

## 3. Install the Python worker

### Windows PowerShell

```powershell
cd ai-agent
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m playwright install chromium
crawl4ai-setup
cd ..
```

If PowerShell blocks activation, either use an appropriate local execution policy or run the environment's executables directly, for example `ai-agent\venv\Scripts\python.exe -m uvicorn ...`.

### Linux or macOS

```bash
cd ai-agent
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m playwright install chromium
crawl4ai-setup
cd ..
```

`crawl4ai-setup` and the Playwright Chromium installation may download browser dependencies. They are required for the corresponding local demo operations.

## 4. Configure environment variables

Create a local backend environment file:

```powershell
Copy-Item backend/.env.example backend/.env
```

Use placeholders while documenting or sharing configuration:

```dotenv
PORT=5000

DB_USER=postgres
DB_PASSWORD=your_database_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hirepilot_db

JWT_SECRET=replace_with_a_long_random_local_secret
JWT_EXPIRES_IN=1d

FRONTEND_URL=http://localhost:3000

EMAIL_USER=your_sender_email@example.com
EMAIL_PASS=your_email_provider_secret
RESET_TOKEN_EXPIRES_MINUTES=15

NODE_ENV=development

AI_WORKER_URL=http://127.0.0.1:8000
AI_WORKER_ENABLED=true
AI_AGENT_QUEUE_ENABLED=true
AI_WORKER_NAME=hirepilot_local_worker
AI_WORKER_TIMEOUT_MS=30000
AI_WORKER_HEALTH_TIMEOUT_MS=5000
AI_BROWSER_TEST_TIMEOUT_MS=30000
AI_CRAWL4AI_DEMO_TIMEOUT_MS=60000
```

Important details:

- `backend/.env` is private and must not be committed.
- The Python worker deliberately reads database and worker settings from `backend/.env`.
- The current Express entrypoint listens on port `5000` directly.
- `NODE_ENV=development` is required for the development-only safe discovery and reset controls.
- Password-reset email requires a configured SMTP account. It is not required for the main dashboard demo.
- Never use a real personal mailbox or app password in a public demo repository.

## 5. Prepare PostgreSQL

Create a local database:

```powershell
createdb -U postgres hirepilot_db
```

### Core-schema prerequisite

The repository's numbered migrations are additive upgrades, not a complete blank-database bootstrap. Before running migration `001`, the database must already contain the original HirePilot core tables, including:

- `users`
- `candidates`
- `jobs`
- `applications`
- `interviews`
- `notifications`

Import the project's core schema or use the existing development database checkpoint first. Do not run the additive migration set against an empty database and assume it creates the entire application schema.

### Migration order

Apply the files in this exact order:

1. `001_notification_center_quality.sql`
2. `002_candidate_full_profile.sql`
3. `003_external_job_discovery.sql`
4. `004_external_agent_foundation.sql`
5. `005_ai_agent_orchestration.sql`
6. `006_ai_agent_queue_live_progress.sql`
7. `007_dummy_external_portal_apply_flow.sql`
8. `008_recruiter_approval_system.sql`
9. `009_external_job_review_system.sql`
10. `010_external_source_allowlist.sql`
11. `011_recruiter_company_profile.sql`

PowerShell:

```powershell
Get-ChildItem database/migrations/*.sql |
  Sort-Object Name |
  ForEach-Object { psql -U postgres -d hirepilot_db -f $_.FullName }
```

Linux or macOS:

```bash
for migration in database/migrations/*.sql; do
  psql -U postgres -d hirepilot_db -f "$migration"
done
```

Review every migration result. PostgreSQL errors must be resolved before starting the application.

## 6. Create local demo users

Public registration accepts Candidate and Recruiter roles. Use synthetic local accounts only:

```text
candidate@example.com / password
recruiter@example.com / password
admin@example.com / password
```

These values are examples, not built-in seed guarantees.

Register the Candidate and Recruiter through the application/API. New recruiters are intentionally created as `pending` and must be approved by an Admin.

The public registration endpoint does not create Admin accounts. For a local-only demo, one safe approach is:

1. Register `admin@example.com` as a Candidate so the backend creates a proper password hash.
2. Promote that specific synthetic record directly in the local database:

```sql
UPDATE users
SET role = 'admin',
    recruiter_status = NULL,
    recruiter_status_reason = NULL,
    recruiter_status_updated_at = NULL
WHERE email = 'admin@example.com';
```

Confirm exactly one row was updated. Production admin provisioning requires a controlled operational process and is not implemented by this local demo instruction.

## 7. Start the project

Use three terminals.

### Terminal 1 — AI worker

Windows:

```powershell
cd ai-agent
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

Linux or macOS:

```bash
cd ai-agent
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health | ConvertTo-Json -Depth 10
```

Expected health data includes worker status, database connectivity, Playwright availability, and:

```json
{
  "crawl4ai": {
    "available": true,
    "mode": "safe_raw_html_discovery"
  }
}
```

### Terminal 2 — backend

```powershell
cd backend
node server.js
```

Open `http://localhost:5000/`. A working database connection returns the backend status and database time.

### Terminal 3 — frontend

```powershell
cd frontend
npm start
```

Open `http://localhost:3000` and sign in with a synthetic local account.

## 8. Build validation

```powershell
cd frontend
npm run build
```

A successful optimized build verifies frontend compilation. It does not replace authenticated workflow testing.

## 9. Safe demo validation

### Crawl4AI raw-HTML demo

Direct worker check:

```powershell
Invoke-RestMethod `
  -Method Post `
  http://127.0.0.1:8000/discovery/crawl4ai-demo |
  ConvertTo-Json -Depth 10
```

This endpoint must return three local demo jobs and `real_web_crawl: false`. In the product flow, run discovery from the Admin Control Panel so allowlist and role checks are enforced.

### Playwright safe browser test

Use the development-only Candidate control. It is designed for local dummy HTML only. Do not point it at LinkedIn, Indeed, a company career page, or any real application form.

## 10. Troubleshooting

### Backend reports database connection failure

- Confirm PostgreSQL is running.
- Verify the placeholder values in `backend/.env` were replaced locally.
- Confirm `hirepilot_db` exists and the core schema plus migrations are present.
- Test with `psql -U postgres -d hirepilot_db`.

### Frontend cannot reach the API

- Confirm `node server.js` is running on port `5000`.
- Check the browser console and backend terminal for an HTTP status.
- The current frontend services use `http://localhost:5000/api`.

### Worker health is degraded

- Confirm the worker can read `backend/.env`.
- Verify the PostgreSQL settings and database availability.
- Run `pip install -r ai-agent/requirements.txt` in the active virtual environment.

### Crawl4AI is unavailable

```powershell
cd ai-agent
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
crawl4ai-setup
```

Restart Uvicorn and recheck `/health`.

### Playwright cannot find Chromium

```powershell
cd ai-agent
.\venv\Scripts\Activate.ps1
python -m playwright install chromium
```

Restart the worker. On Windows, the project uses an isolated child-process workaround for the subprocess event-loop limitation.

### Discovery button is disabled or rejected

- Use an Admin account.
- Keep `NODE_ENV=development` for the demo.
- Confirm the `crawl4ai_demo` source exists.
- Set that source to both **Approved** and **Enabled** in External Sources.
- Confirm `AI_WORKER_ENABLED=true` and the worker is online.

### Recruiter cannot post a job

Open the Admin Control Panel and approve the recruiter. A pending or blocked recruiter correctly receives HTTP `403`; company verification is currently recommended but is not the posting gate.

### Demo jobs are missing for candidates

Discovered jobs are not automatically candidate-visible. Approve them in Admin → External Job Review. Hidden, rejected, and pending-review records remain unavailable to candidates.

## 11. Security checklist

Before sharing the repository or recording a demo:

- use synthetic accounts and a synthetic resume;
- remove local `.env` files and uploaded documents from the shared artifact;
- do not show JWTs, reset tokens, database passwords, or SMTP credentials;
- do not claim that the demo crawls or applies through real external portals;
- review [PRIVACY_CHECKLIST.md](PRIVACY_CHECKLIST.md).
