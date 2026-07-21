# HirePilot AI E2E Demo Checklist

Use this fast checklist immediately before a presentation. For narration and detailed expected results, use the full [Demo Guide](DEMO_GUIDE.md).

## Safety boundary

- [ ] Complete [PRIVACY_CHECKLIST.md](PRIVACY_CHECKLIST.md) before recording or publishing the demo.
- [ ] Use synthetic accounts, company data, jobs, and resumes only.
- [ ] Confirm Crawl4AI remains in `safe_raw_html_discovery` mode.
- [ ] Confirm Playwright is used only with the HirePilot safe dummy portal.
- [ ] Do not crawl or apply through LinkedIn, Indeed, or real company websites.
- [ ] Do not display `.env`, JWTs, database passwords, SMTP credentials, or reset tokens.

## Service preflight

- [ ] **Start AI worker**

  ```powershell
  cd ai-agent
  .\venv\Scripts\Activate.ps1
  uvicorn main:app --reload --port 8000
  ```

- [ ] **Start backend**

  ```powershell
  cd backend
  node server.js
  ```

- [ ] **Start frontend**

  ```powershell
  cd frontend
  npm start
  ```

- [ ] Run the local health check from the repository root.

  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\demo-health-check.ps1
  ```

- [ ] Resolve every **FAIL** and review each **WARN**.
- [ ] Open `http://localhost:3000`.

## Admin flow

- [ ] **Login as Admin** and confirm redirect to `/admin`.
- [ ] Open **Recruiters** and **check Recruiter approval**.
- [ ] Leave the demo Recruiter in `approved` status.
- [ ] Open **External Sources** and **check the external source allowlist**.
- [ ] Confirm `crawl4ai_demo` is both approved and enabled.
- [ ] Open **Discovery** and **run Crawl4AI demo discovery**.
- [ ] Confirm the completion message shows discovered, inserted, and updated counts.
- [ ] Open **External Job Review** and **review external jobs**.
- [ ] Approve at least one Crawl4AI demo job.
- [ ] Optionally hide a different demo job and confirm the status changes.

## Recruiter flow

- [ ] **Login as Recruiter** and confirm redirect to `/recruiter`.
- [ ] Open **Company Profile** and **check company verification**.
- [ ] Save a synthetic company profile if one is not present.
- [ ] If demonstrating Verified Employer, login briefly as Admin and verify the company, then return as Recruiter.
- [ ] Open **Post Job** and **post a synthetic internal job**.
- [ ] Confirm the job appears in **My Jobs**.

## Candidate flow

- [ ] **Login as Candidate** and confirm redirect to `/candidate`.
- [ ] Open **Matched Jobs**.
- [ ] **Check the Verified Employer badge** on the verified company's job.
- [ ] **Apply to an internal job** using the current Candidate application action.
- [ ] Open **Applications** and **check the Application Control Center**.
- [ ] Confirm internal, external, and pending-manual sections and filters render correctly.
- [ ] Open **External Jobs** and locate **Safe Dummy Frontend Engineer**.
- [ ] Use **View Source** and confirm the safe-demo notice.
- [ ] **Apply to the safe dummy external job**.
- [ ] If already applied, use the development-only safe dummy reset and apply again.
- [ ] Open **AI Agent Timeline** and **check the new run and ordered steps**.
- [ ] Confirm latest-first order, status filters, and friendly error handling.

## Hiring completion flow

- [ ] Login as Recruiter and open the demo job's applicants.
- [ ] **Shortlist the Candidate**.
- [ ] **Schedule an interview** for a future synthetic date/time.
- [ ] Login as Candidate.
- [ ] Confirm the **Candidate notification** is visible.
- [ ] Confirm the scheduled interview appears in **Interviews**.
- [ ] Confirm Overview counts reflect the workflow.

## Final presentation readiness

- [ ] No horizontal scrollbar appears in any workspace.
- [ ] Candidate, Recruiter, and Admin tabs switch correctly.
- [ ] No raw stack trace is visible by default.
- [ ] No real external website opened during discovery or application testing.
- [ ] The safe dummy run and interview flow completed successfully.
- [ ] Browser tabs and terminals are arranged for a clean presentation.

## Demo result

```text
[ ] READY — all required checks passed
[ ] READY WITH WARNINGS — warnings are understood and do not affect the planned path
[ ] NOT READY — one or more required checks failed
```
