# Demo Health Check Script

`demo-health-check.ps1` performs read-only readiness checks against the local HirePilot demo stack.

## Run it

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\demo-health-check.ps1
```

If the current PowerShell session already permits local scripts:

```powershell
.\scripts\demo-health-check.ps1
```

Optional request timeout, in seconds:

```powershell
.\scripts\demo-health-check.ps1 -TimeoutSeconds 10
```

## Checks performed

- Express backend root at `http://127.0.0.1:5000/`, with `localhost` fallback
- FastAPI worker health at `http://127.0.0.1:8000/health`
- Worker PostgreSQL connectivity reported by `/health`
- Crawl4AI safe raw-HTML availability when reported by the worker
- Playwright safe dummy-browser availability when reported by the worker
- Optional queue statistics at `http://127.0.0.1:8000/queue/stats`
- React frontend at `http://localhost:3000/`

## Result meanings

- **PASS** — the check is ready.
- **WARN** — an optional capability or diagnostic is unavailable; review it before presenting.
- **FAIL** — a required part of the demo stack is not ready.

The script returns exit code `1` when any required check fails and `0` when there are no failures. Missing services include their exact local start commands in the output.

## Safety

The script:

- sends GET requests to localhost only;
- does not authenticate or read tokens;
- does not print environment variables or secrets;
- does not modify files;
- does not reset or write to PostgreSQL;
- does not invoke discovery or browser-apply endpoints;
- does not contact LinkedIn, Indeed, company career pages, or any other external website.

Passing this script confirms service readiness, not the complete role-based workflow. Continue with [E2E_DEMO_CHECKLIST.md](../docs/E2E_DEMO_CHECKLIST.md).
