# HirePilot AI Demo Guide

This script presents the platform as a complete local recruitment workflow while keeping external discovery and automation inside their safe demo boundaries.

For a condensed presentation-day pass, use the [E2E Demo Checklist](E2E_DEMO_CHECKLIST.md). Run the local [Demo Health Check](../scripts/demo-health-check.md) before beginning this full script.

## Demo promise

Use these statements consistently:

- HirePilot demonstrates governed external discovery with raw local HTML.
- Crawl4AI does not contact a real website in this demo.
- Playwright fills a safe local dummy form only.
- LinkedIn and Indeed records are simulations, not live integrations.
- Real external-portal support and production deployment are roadmap items.

## Demo accounts

Prepare synthetic accounts before presenting:

| Role | Email | Password |
| --- | --- | --- |
| Candidate | `candidate@example.com` | `password` |
| Recruiter | `recruiter@example.com` | `password` |
| Admin | `admin@example.com` | `password` |

These are placeholder credentials. Create them locally; do not reuse real passwords or personal email accounts.

## Before the demo

- Use a synthetic Candidate profile and PDF resume.
- Apply database migrations `001–011` in order.
- Keep `NODE_ENV=development` for safe demo controls.
- Configure `AI_WORKER_ENABLED=true` and the local worker URL.
- Confirm `crawl4ai_demo` is approved and enabled.
- Confirm the safe dummy external job exists from migration `007`.
- Avoid showing terminals containing environment values or tokens.
- If the safe dummy job was used previously, reset only that application with the development control before presenting.

## 1. Start all services

Open three terminals.

Worker:

```powershell
cd ai-agent
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

Backend:

```powershell
cd backend
node server.js
```

Frontend:

```powershell
cd frontend
npm start
```

Verify:

- `http://127.0.0.1:8000/health`
- `http://localhost:5000/`
- `http://localhost:3000`

Then run the read-only stack check from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\demo-health-check.ps1
```

Resolve all **FAIL** results and review any **WARN** result before logging in. The script performs localhost GET requests only; it does not run discovery, launch Playwright, or change application data.

Expected story: the React application uses the Express API, PostgreSQL stores business/audit data, and FastAPI handles controlled worker operations.

## 2. Login as Admin

Sign in with `admin@example.com / password`.

Show:

- automatic redirect to `/admin`;
- the **Admin Control Panel** role label;
- Overview counts;
- the Recruiters, Company Verification, External Sources, Discovery, and External Job Review tabs.

Expected story: platform governance is separated from Candidate and Recruiter workflows.

## 3. Approve or block a Recruiter

Open **Recruiters**.

1. Locate `recruiter@example.com`.
2. Explain that new recruiters begin in `pending` status.
3. Briefly demonstrate **Block** if a reversible status transition is useful.
4. Finish by clicking **Approve**.

Expected result: the recruiter is approved and can publish jobs. Pending and blocked recruiters receive a clear `403` if they attempt to post.

## 4. Review external sources

Open **External Sources**.

Highlight the `crawl4ai_demo` source:

- type: `demo_raw_html`;
- safety mode: `safe_raw_html_only`;
- trust status: approved;
- state: enabled;
- source reference: `crawl4ai-demo://safe-raw-html`.

Explain that creating a source does not contact it. A source must be independently approved and enabled before discovery can use it.

Optional governance demonstration:

1. Disable the source.
2. Open Discovery and show that the operation is unavailable.
3. Re-enable and approve the source.

## 5. Run Crawl4AI demo discovery

Open **Discovery** and read the safety note: “Safe raw local demo HTML only. No external website is contacted.”

Click **Run Crawl4AI Demo Discovery**.

Expected result:

```text
Crawl4AI demo discovery completed. Discovered: 3; inserted: X; updated: Y.
```

The exact inserted and updated counts depend on whether the demo was run before. Repeated runs update matching records rather than intentionally creating duplicates.

Expected story: the Admin invokes the backend, the backend validates the allowlist, the worker extracts three deterministic jobs from raw local HTML, and the backend stores them for review.

## 6. Approve and hide external jobs

Open **External Job Review**.

1. Locate a Crawl4AI Demo Discovery job.
2. Add an optional review note.
3. Click **Approve**.
4. On another demo job, click **Hide** and explain that it will not be candidate-visible.
5. Optionally use **Mark Pending** or **Reject** to show the moderation lifecycle.

Expected result: only approved external jobs can appear in the Candidate Workspace.

## 7. Login as Recruiter

Sign out or clear the demo session, then sign in with `recruiter@example.com / password`.

Show:

- redirect to `/recruiter`;
- the **Recruiter Workspace** label;
- Overview metrics;
- tabs for Company Profile, Post Job, My Jobs, Applicants, and Interviews.

Expected story: recruiter approval controls posting, while company verification is a separate trust workflow.

## 8. Save a company profile

Open **Company Profile** and enter synthetic information, for example:

```text
Company name: Demo Company
Website: https://demo-company.example
Industry: Technology
Company size: 51-200 employees
Headquarters: Jaipur, India
Description: Synthetic employer profile used for the HirePilot local demo.
```

Click **Save Company Profile**.

Expected result: the profile is saved with a pending verification state. The page explains that verification helps candidates trust posted jobs.

### Verify the company before the trust-badge segment

To demonstrate a verified employer later:

1. Login again as Admin.
2. Open **Company Verification**.
3. Locate Demo Company and click **Verify**.
4. Optionally save a synthetic verification note.
5. Return to the Recruiter account.

This extra role transition is required because recruiter approval does not automatically verify a company.

## 9. Post a job

Open **Post Job** and create a synthetic internal role, for example:

```text
Job title: Demo Frontend Engineer
Company: Demo Company
Required skills: React, JavaScript, CSS
Experience: 1
Salary: Demo range
Location: Remote
Description: Synthetic role for the HirePilot local demo.
```

Click **Publish Job**.

Expected result: the approved Recruiter posts successfully. The job appears in **My Jobs** with company trust context.

## 10. Login as Candidate

Sign in with `candidate@example.com / password`.

Show:

- redirect to `/candidate`;
- the **Candidate Workspace** label;
- Overview metrics and all Candidate tabs;
- Profile completion and ATS score if available.

If necessary, complete the synthetic profile and upload a synthetic PDF resume before continuing.

## 11. View matched jobs

Open **Matched Jobs**.

Explain that the backend compares Candidate profile skills and preferences with internal jobs. Point out match scores and employer trust indicators.

Expected result: the synthetic role is visible when it meets the Candidate's matching criteria.

## 12. View the Verified Employer badge

On the Demo Company job, highlight **Verified Employer**.

Explain:

- the badge comes from Admin verification of the Recruiter's company profile;
- pending or unverified companies receive a different badge;
- verification is a trust signal and does not silently alter an application.

## 13. Apply to an internal job

Use the current Candidate internal-application action, including **Auto Apply** where appropriate for the matched-job workflow.

Open **Applications** and show the internal application in the Application Control Center.

Expected result: the application includes job, company, status, and applied date when available. It is not duplicated by switching filters or refreshing.

## 14. Apply to the safe dummy external job

Open **External Jobs** and locate **Safe Dummy Frontend Engineer** from **HirePilot Safe Dummy Portal**.

1. Click **View Source**.
2. Point out the safe source label and non-live reference.
3. Close the preview.
4. Click **Apply with HirePilot**.

If it was previously applied, open **AI Agent Timeline** and use the development-only **Reset Safe Dummy Apply** control, then retry.

Expected result: Playwright works against safe local dummy HTML. No LinkedIn, Indeed, or real company application is opened or submitted.

## 15. View the Application Control Center

Open **Applications**.

Show:

- summary cards for internal, external, manual, and interview activity;
- filters for All, Internal, External, and Pending Manual;
- **Internal Applications**;
- **External Apply Tracker**;
- **Pending Manual Actions**.

Explain that statuses distinguish applied, pending manual action, failed, cancelled, and manually completed outcomes.

## 16. View the AI Agent Timeline

Open **AI Agent Timeline**.

Show:

- worker health and live progress;
- latest run first;
- All, Active, Completed, and Failed filters;
- ordered run steps;
- friendly failure summaries;
- collapsed technical details;
- Retry and Cancel controls when allowed.

Expected result: the safe dummy run completes with recorded steps. If a workflow needs user input, it is represented as manual action rather than a false success.

## 17. Recruiter shortlists the Candidate

Login as Recruiter and open **My Jobs**.

1. Select the demo job.
2. Click **View Applicants**.
3. Open **Applicants**.
4. Show ranking metrics, candidate preview, and synthetic resume controls.
5. Click **Shortlist** for the demo Candidate.

Expected result: the applicant status changes and a Candidate notification is created.

## 18. Recruiter schedules an interview

Open **Interviews** or use the selected applicant's interview controls.

1. Enter a future synthetic date/time.
2. Add a safe meeting reference if the form supports it.
3. Click **Schedule Interview**.

Optionally demonstrate reschedule and cancel controls, then leave one active interview for the final Candidate view.

## 19. Candidate sees the notification and interview

Login as Candidate.

1. Open **Notifications** and show the shortlist/interview update.
2. Demonstrate mark-read behavior.
3. Open **Interviews** and show the upcoming interview card.
4. Return to **Overview** to show the updated summary counts.

Expected story: HirePilot connects governance, recruiter action, Candidate transparency, and auditable automation across all three roles.

## Closing statement

HirePilot AI currently provides a working local recruitment platform and safe automation foundation. Its external discovery and browser demonstrations are deliberately constrained. Production deployment, real allowlisted external integrations, and deeper agent orchestration remain planned work.
