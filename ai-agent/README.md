# HirePilot AI Agent Worker Stub

This is a safe local Python worker foundation for future LangGraph/Playwright automation.
It does not submit real applications to LinkedIn, Indeed, or company career pages.

## Run locally

```bash
cd ai-agent
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Health check:

```text
http://localhost:8000/health
```

The worker reads PostgreSQL settings from `../backend/.env`.
