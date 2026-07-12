from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import json
import os
import subprocess
import sys
import re

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import psycopg2
import psycopg2.extras

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
BACKEND_ENV = PROJECT_ROOT / "backend" / ".env"

load_dotenv(BACKEND_ENV)

app = FastAPI(
    title="HirePilot AI Agent Worker",
    version="0.1.0",
    description="Safe local AI-agent worker stub for external apply orchestration.",
)

WORKER_NAME = os.getenv("AI_WORKER_NAME", "python_external_apply_worker_stub")


def get_crawl4ai_status() -> Dict[str, Any]:
    try:
        from crawl4ai import AsyncWebCrawler  # noqa: F401

        return {
            "available": True,
            "mode": "safe_raw_html_discovery",
            "message": "Crawl4AI is available for hardcoded raw HTML demo discovery only.",
        }
    except Exception as error:
        return {
            "available": False,
            "mode": "safe_raw_html_discovery",
            "message": "Crawl4AI is not installed or could not be imported.",
            "error": str(error),
            "install_hint": "pip install -r requirements.txt && crawl4ai-setup",
        }


def build_crawl4ai_demo_html() -> str:
    return """
    <!doctype html>
    <html>
      <head><meta charset="utf-8"><title>HirePilot Crawl4AI Demo Jobs</title></head>
      <body>
        <main id="demo-jobs">
          <article class="demo-job-card">
            <h2 class="job-title">Demo React UI Engineer</h2>
            <p class="company-name">PixelForge Demo Labs</p>
            <p class="location">Remote</p>
            <p class="required-skills">React,JavaScript,HTML,CSS</p>
            <p class="experience-required">1</p>
            <p class="job-description">Build accessible demo interfaces from local product specifications.</p>
          </article>
          <article class="demo-job-card">
            <h2 class="job-title">Demo Python Data Analyst</h2>
            <p class="company-name">InsightWorks Sandbox</p>
            <p class="location">Jaipur / Remote</p>
            <p class="required-skills">Python,SQL,Excel,Power BI</p>
            <p class="experience-required">0</p>
            <p class="job-description">Analyze safe demo datasets and prepare deterministic dashboard summaries.</p>
          </article>
          <article class="demo-job-card">
            <h2 class="job-title">Demo AI Automation Associate</h2>
            <p class="company-name">AgentCraft Demo Studio</p>
            <p class="location">Remote</p>
            <p class="required-skills">Python,SQL,AI,Playwright</p>
            <p class="experience-required">1</p>
            <p class="job-description">Support local-only AI workflow prototypes and safe browser test automation.</p>
          </article>
        </main>
      </body>
    </html>
    """


def crawl4ai_demo_slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "demo-job"


async def discover_crawl4ai_demo_jobs() -> List[Dict[str, Any]]:
    try:
        from crawl4ai import AsyncWebCrawler, CacheMode, CrawlerRunConfig
        from crawl4ai.extraction_strategy import JsonCssExtractionStrategy
    except Exception as error:
        raise RuntimeError(
            "Crawl4AI is unavailable. Run: pip install -r requirements.txt && crawl4ai-setup"
        ) from error

    extraction_schema = {
        "name": "HirePilot Safe Demo Jobs",
        "baseSelector": "article.demo-job-card",
        "fields": [
            {"name": "job_title", "selector": ".job-title", "type": "text"},
            {"name": "company_name", "selector": ".company-name", "type": "text"},
            {"name": "location", "selector": ".location", "type": "text"},
            {"name": "required_skills", "selector": ".required-skills", "type": "text"},
            {
                "name": "experience_required",
                "selector": ".experience-required",
                "type": "text",
            },
            {
                "name": "job_description",
                "selector": ".job-description",
                "type": "text",
            },
        ],
    }
    crawl_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        extraction_strategy=JsonCssExtractionStrategy(schema=extraction_schema),
    )

    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(
            url="raw:" + build_crawl4ai_demo_html(),
            config=crawl_config,
        )

    if not result.success:
        raise RuntimeError(
            result.error_message or "Crawl4AI could not process the safe raw HTML demo."
        )

    extracted_jobs = json.loads(result.extracted_content or "[]")
    if not isinstance(extracted_jobs, list) or len(extracted_jobs) != 3:
        raise RuntimeError("Crawl4AI demo extraction did not return the expected 3 jobs.")

    jobs: List[Dict[str, Any]] = []
    for extracted_job in extracted_jobs:
        job_title = str(extracted_job.get("job_title") or "").strip()
        company_name = str(extracted_job.get("company_name") or "").strip()
        if not job_title or not company_name:
            raise RuntimeError("Crawl4AI demo extraction returned an incomplete job record.")

        try:
            experience_required = max(
                int(extracted_job.get("experience_required") or 0),
                0,
            )
        except (TypeError, ValueError):
            experience_required = 0

        jobs.append(
            {
                "job_title": job_title,
                "company_name": company_name,
                "location": str(extracted_job.get("location") or "Remote").strip(),
                "required_skills": str(
                    extracted_job.get("required_skills") or ""
                ).strip(),
                "experience_required": experience_required,
                "job_description": str(
                    extracted_job.get("job_description") or ""
                ).strip(),
                "source_platform": "Crawl4AI Demo Discovery",
                "apply_mode": "manual_questions",
                "job_url": f"crawl4ai-demo://{crawl4ai_demo_slug(job_title)}",
                "discovery_source": "safe_raw_html",
            }
        )

    return jobs


def run_crawl4ai_demo_discovery_isolated() -> List[Dict[str, Any]]:
    """
    Run Crawl4AI in a fresh process so its Playwright transport owns a Windows
    event loop that supports subprocess creation. The child receives no URL or
    request data; it can only execute the hardcoded raw HTML demo above.
    """
    timeout_ms = int(os.getenv("AI_CRAWL4AI_DEMO_TIMEOUT_MS", "60000"))
    result_marker = "HIREPILOT_CRAWL4AI_RESULT="
    command = [
        sys.executable,
        "-c",
        (
            "import asyncio, json, sys; "
            "policy = getattr(asyncio, 'WindowsProactorEventLoopPolicy', None); "
            "sys.platform == 'win32' and policy and "
            "asyncio.set_event_loop_policy(policy()); "
            "from main import discover_crawl4ai_demo_jobs; "
            f"print('{result_marker}' + json.dumps("
            "asyncio.run(discover_crawl4ai_demo_jobs())))"
        ),
    ]

    try:
        completed = subprocess.run(
            command,
            cwd=str(BASE_DIR),
            capture_output=True,
            text=True,
            timeout=max(timeout_ms / 1000, 10),
        )
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(
            "Crawl4AI safe raw HTML demo discovery timed out. "
            "No external website was contacted."
        ) from error
    except OSError as error:
        raise RuntimeError(
            f"Unable to start isolated Crawl4AI demo process: {error}"
        ) from error

    if completed.returncode != 0:
        error_output = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(
            "Isolated Crawl4AI demo process failed: "
            + (error_output[-4000:] or "No error output was returned.")
        )

    result_line = next(
        (
            line
            for line in reversed(completed.stdout.splitlines())
            if line.startswith(result_marker)
        ),
        None,
    )
    if not result_line:
        raise RuntimeError(
            "Isolated Crawl4AI demo process returned no structured result."
        )

    try:
        jobs = json.loads(result_line[len(result_marker) :])
    except json.JSONDecodeError as error:
        raise RuntimeError(
            "Unable to parse isolated Crawl4AI demo process output."
        ) from error

    if not isinstance(jobs, list) or len(jobs) != 3:
        raise RuntimeError(
            "Isolated Crawl4AI demo process did not return the expected 3 jobs."
        )

    if any(
        job.get("discovery_source") != "safe_raw_html"
        or job.get("source_platform") != "Crawl4AI Demo Discovery"
        or job.get("apply_mode") != "manual_questions"
        or not str(job.get("job_url") or "").startswith("crawl4ai-demo://")
        for job in jobs
    ):
        raise RuntimeError(
            "Isolated Crawl4AI demo process returned an unsafe job record."
        )

    return jobs



def get_playwright_status() -> Dict[str, Any]:
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401

        return {
            "available": True,
            "mode": "safe_local_browser_automation",
            "message": "Playwright package is installed. Run browser smoke test to verify Chromium browser installation.",
        }
    except Exception as error:
        return {
            "available": False,
            "mode": "not_available",
            "message": "Playwright package is not available in the selected Python environment.",
            "error": str(error),
            "install_hint": "pip install -r requirements.txt && python -m playwright install chromium",
        }


def run_playwright_safe_form_fill(
    full_name: str = "HirePilot Test Candidate",
    email: str = "candidate@example.com",
    phone: str = "Not provided",
    location: str = "Location not provided",
    role: str = "Junior Full Stack Developer",
    experience: str = "0 years",
    skills: str = "Python, SQL, React, JavaScript, HTML, CSS",
    resume_filename: str = "candidate-resume.pdf",
    professional_summary: str = "Professional summary not provided",
    company_name: str = "HirePilot Safe Dummy Portal",
) -> Dict[str, Any]:
    try:
        from playwright.sync_api import sync_playwright
    except Exception as error:
        raise RuntimeError(
            "Playwright is not installed in this Python environment. "
            "Run: pip install -r requirements.txt && python -m playwright install chromium"
        ) from error

    html = """
    <!doctype html>
    <html>
      <head>
        <meta charset='utf-8' />
        <title>HirePilot Safe Dummy Portal</title>
      </head>
      <body>
        <h1>HirePilot Safe Dummy Job Portal</h1>
        <p id='portal-note'>This is a local dummy page. No real external portal submission occurs.</p>
        <form id='application-form'>
          <label>Full Name <input id='full_name' name='full_name' /></label>
          <label>Email <input id='email' name='email' /></label>
          <label>Phone <input id='phone' name='phone' /></label>
          <label>Location <input id='location' name='location' /></label>
          <label>Company <input id='company_name' name='company_name' /></label>
          <label>Role <input id='role' name='role' /></label>
          <label>Experience <input id='experience' name='experience' /></label>
          <label>Skills <textarea id='skills' name='skills'></textarea></label>
          <label>Resume <input id='resume_filename' name='resume_filename' /></label>
          <label>Professional Summary <textarea id='professional_summary' name='professional_summary'></textarea></label>
          <button id='submit-application' type='submit'>Submit Application</button>
        </form>
        <div id='result'></div>
        <script>
          document.getElementById('application-form').addEventListener('submit', function(event) {
            event.preventDefault();
            document.getElementById('result').textContent = 'Dummy application submitted safely';
          });
        </script>
      </body>
    </html>
    """

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page()
            page.set_content(html)
            page.fill("#full_name", full_name or "HirePilot Test Candidate")
            page.fill("#email", email or "candidate@example.com")
            page.fill("#phone", phone or "Not provided")
            page.fill("#location", location or "Location not provided")
            page.fill("#company_name", company_name or "HirePilot Safe Dummy Portal")
            page.fill("#role", role or "External Job Candidate")
            page.fill("#experience", experience or "0 years")
            page.fill("#skills", skills or "Profile skills not provided")
            page.fill("#resume_filename", resume_filename or "candidate-resume.pdf")
            page.fill(
                "#professional_summary",
                professional_summary or "Professional summary not provided",
            )
            page.click("#submit-application")
            result_text = page.locator("#result").inner_text(timeout=3000)
            browser.close()
    except Exception as error:
        message = str(error)
        if "Executable doesn't exist" in message or "playwright install" in message.lower():
            raise RuntimeError(
                "Playwright browser binaries are missing. Run: python -m playwright install chromium"
            ) from error
        raise

    return {
        "success": result_text == "Dummy application submitted safely",
        "result_text": result_text,
        "portal": "safe_dummy_local_page",
        "browser": "chromium_headless",
        "company_name": company_name,
        "role": role,
        "real_external_submission": False,
    }

def run_playwright_safe_form_fill_isolated() -> Dict[str, Any]:
    """
    Run the Playwright smoke test in a separate Python process.

    On Windows, Playwright can raise NotImplementedError when Chromium is
    launched from a FastAPI/Uvicorn worker thread. Running the browser smoke
    test in an isolated Python process keeps the browser launch in that child
    process main thread while preserving the same venv and project code.
    """
    timeout_ms = int(os.getenv("AI_BROWSER_TEST_TIMEOUT_MS", "30000"))
    command = [
        sys.executable,
        "-c",
        (
            "import json; "
            "from main import run_playwright_safe_form_fill; "
            "print(json.dumps(run_playwright_safe_form_fill()))"
        ),
    ]

    try:
        completed = subprocess.run(
            command,
            cwd=str(BASE_DIR),
            capture_output=True,
            text=True,
            timeout=max(timeout_ms / 1000, 5),
        )
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(
            "Playwright safe browser smoke test timed out. "
            "Try increasing AI_BROWSER_TEST_TIMEOUT_MS in backend/.env."
        ) from error

    if completed.returncode != 0:
        error_output = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(
            error_output
            or "Isolated Playwright browser process failed without output."
        )

    output = completed.stdout.strip()
    if not output:
        raise RuntimeError("Isolated Playwright browser process returned no output.")

    last_line = output.splitlines()[-1]
    try:
        return json.loads(last_line)
    except json.JSONDecodeError as error:
        raise RuntimeError(
            f"Unable to parse Playwright smoke test output: {last_line}"
        ) from error



def run_playwright_external_apply_isolated(
    *,
    full_name: str,
    email: str,
    phone: str,
    location: str,
    job_title: str,
    company_name: str,
    experience_years: Optional[int],
    skills: str,
    resume_filename: str,
    professional_summary: str,
) -> Dict[str, Any]:
    """
    Run the safe dummy external apply browser flow in a child process.

    This keeps Windows + FastAPI/Uvicorn stable and uses the same working path
    as the browser smoke test. No real portal, login, CAPTCHA, or resume upload
    is performed.
    """
    timeout_ms = int(os.getenv("AI_BROWSER_TEST_TIMEOUT_MS", "30000"))
    safe_payload = {
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "location": location,
        "role": job_title or "External Job Candidate",
        "experience": f"{experience_years or 0} years",
        "skills": skills,
        "resume_filename": resume_filename,
        "professional_summary": professional_summary,
        "company_name": company_name or "HirePilot Safe Dummy Portal",
    }

    command = [
        sys.executable,
        "-c",
        (
            "import json, os; "
            "from main import run_playwright_safe_form_fill; "
            "payload=json.loads(os.environ.get('HIREPILOT_SAFE_BROWSER_PAYLOAD', '{}')); "
            "print(json.dumps(run_playwright_safe_form_fill(**payload)))"
        ),
    ]

    child_env = os.environ.copy()
    child_env["HIREPILOT_SAFE_BROWSER_PAYLOAD"] = json.dumps(safe_payload)

    try:
        completed = subprocess.run(
            command,
            cwd=str(BASE_DIR),
            env=child_env,
            capture_output=True,
            text=True,
            timeout=max(timeout_ms / 1000, 5),
        )
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(
            "Safe dummy external apply browser flow timed out. "
            "Try increasing AI_BROWSER_TEST_TIMEOUT_MS in backend/.env."
        ) from error

    if completed.returncode != 0:
        error_output = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(
            error_output
            or "Safe dummy external apply browser process failed without output."
        )

    output = completed.stdout.strip()
    if not output:
        raise RuntimeError("Safe dummy external apply browser process returned no output.")

    last_line = output.splitlines()[-1]
    try:
        return json.loads(last_line)
    except json.JSONDecodeError as error:
        raise RuntimeError(
            f"Unable to parse safe dummy external apply output: {last_line}"
        ) from error

def db_config() -> Dict[str, Any]:
    return {
        "user": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "5432")),
        "database": os.getenv("DB_NAME"),
    }


def get_connection():
    missing = [key for key, value in db_config().items() if value in (None, "")]
    if missing:
        raise RuntimeError(f"Missing database configuration: {', '.join(missing)}")

    return psycopg2.connect(**db_config())


def json_dump(value: Optional[Dict[str, Any]]) -> str:
    return json.dumps(value or {})


def serialize_row(row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if row is None:
        return None

    result: Dict[str, Any] = {}
    for key, value in row.items():
        if isinstance(value, datetime):
            result[key] = value.isoformat()
        else:
            result[key] = value
    return result


def add_step(
    cursor,
    agent_run_id: int,
    step_name: str,
    step_order: int,
    details: str,
    step_status: str = "completed",
    metadata: Optional[Dict[str, Any]] = None,
):
    cursor.execute(
        """
        INSERT INTO ai_agent_run_steps (
          agent_run_id,
          step_name,
          step_status,
          step_order,
          details,
          metadata
        )
        VALUES (%s, %s, %s, %s, %s, %s::jsonb)
        """,
        (
            agent_run_id,
            step_name,
            step_status,
            step_order,
            details,
            json_dump(metadata),
        ),
    )


def update_run(
    cursor,
    agent_run_id: int,
    run_status: str,
    current_step: str,
    summary: Optional[str] = None,
    error_message: Optional[str] = None,
    external_application_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
    completed: bool = False,
):
    cursor.execute(
        """
        UPDATE ai_agent_runs
        SET run_status = %s,
            current_step = %s,
            summary = COALESCE(%s, summary),
            error_message = %s,
            external_application_id = COALESCE(%s, external_application_id),
            metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb,
            locked_by = CASE WHEN %s THEN NULL ELSE COALESCE(locked_by, %s) END,
            locked_at = CASE WHEN %s THEN NULL ELSE COALESCE(locked_at, CURRENT_TIMESTAMP) END,
            last_heartbeat_at = CURRENT_TIMESTAMP,
            queue_error = %s,
            completed_at = CASE WHEN %s THEN CURRENT_TIMESTAMP ELSE completed_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE agent_run_id = %s
        """,
        (
            run_status,
            current_step,
            summary,
            error_message,
            external_application_id,
            json_dump(metadata),
            completed or run_status in {"completed", "failed", "skipped", "cancelled"},
            WORKER_NAME,
            completed or run_status in {"completed", "failed", "skipped", "cancelled"},
            error_message,
            completed,
            agent_run_id,
        ),
    )


def log_attempt(
    cursor,
    candidate_id: int,
    external_job_id: Optional[int],
    external_application_id: Optional[int],
    action_type: str,
    attempt_status: str,
    source_platform: Optional[str],
    failure_reason: Optional[str],
    metadata: Optional[Dict[str, Any]] = None,
):
    cursor.execute(
        """
        INSERT INTO agent_attempt_logs (
          candidate_id,
          external_job_id,
          external_application_id,
          agent_name,
          action_type,
          attempt_status,
          source_platform,
          failure_reason,
          metadata
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
        """,
        (
            candidate_id,
            external_job_id,
            external_application_id,
            WORKER_NAME,
            action_type,
            attempt_status,
            source_platform,
            failure_reason,
            json_dump(metadata),
        ),
    )


class ExternalApplyPayload(BaseModel):
    agent_run_id: int
    candidate_id: int
    external_job_id: int
    requested_by_user_id: Optional[int] = None
    job_title: str
    company_name: str
    source_platform: Optional[str] = None
    job_url: Optional[str] = None
    apply_mode: str
    match_score: int
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    current_location: Optional[str] = None
    skills: Optional[str] = None
    preferred_role: Optional[str] = None
    preferred_location: Optional[str] = None
    experience_years: Optional[int] = None
    resume_filename: Optional[str] = None
    professional_summary: Optional[str] = None
    force_retry: bool = False
    retry_source_agent_run_id: Optional[int] = None


class BrowserSmokePayload(BaseModel):
    agent_run_id: int
    candidate_id: int
    requested_by_user_id: Optional[int] = None


def safe_profile_value(value: Optional[str], fallback: str) -> Tuple[str, bool]:
    if value is not None and str(value).strip():
        return str(value).strip(), False

    return fallback, True


def build_safe_candidate_profile(payload: ExternalApplyPayload) -> Dict[str, Any]:
    fallback_fields: List[str] = []

    def resolve(field_name: str, value: Optional[str], fallback: str) -> str:
        resolved_value, used_fallback = safe_profile_value(value, fallback)
        if used_fallback:
            fallback_fields.append(field_name)
        return resolved_value

    current_location = payload.current_location or payload.preferred_location
    experience_years = payload.experience_years
    if experience_years is None or experience_years < 0:
        experience_years = 0
        fallback_fields.append("experience_years")

    return {
        "full_name": resolve("full_name", payload.full_name, "HirePilot Candidate"),
        "email": resolve("email", payload.email, "candidate@example.com"),
        "phone": resolve("phone", payload.phone, "Not provided"),
        "location": resolve(
            "current_location",
            current_location,
            "Location not provided",
        ),
        "skills": resolve("skills", payload.skills, "Profile skills not provided"),
        "experience_years": experience_years,
        "preferred_role": resolve(
            "preferred_role",
            payload.preferred_role,
            "External Job Candidate",
        ),
        "resume_filename": resolve(
            "resume_filename",
            payload.resume_filename,
            "candidate-resume.pdf",
        ),
        "professional_summary": resolve(
            "professional_summary",
            payload.professional_summary,
            "Professional summary not provided",
        ),
        "fallback_fields": fallback_fields,
    }


def split_skills(skills: Optional[str]) -> List[str]:
    if not skills:
        return []

    return [skill.strip().lower() for skill in skills.split(",") if skill.strip()]


def calculate_match(candidate: Dict[str, Any], job: Dict[str, Any]) -> Dict[str, Any]:
    candidate_skills = split_skills(candidate.get("skills"))
    job_skills = split_skills(job.get("required_skills"))

    matched_skills = []
    missing_skills = []

    for skill in job_skills:
        label = " ".join(part.capitalize() for part in skill.split(" "))
        if skill in candidate_skills:
            matched_skills.append(label)
        else:
            missing_skills.append(label)

    score = len(matched_skills) * 20

    preferred_role = candidate.get("preferred_role")
    if preferred_role and job.get("job_title"):
        role_key = preferred_role.lower().split(" ")[0]
        if role_key in job["job_title"].lower():
            score += 10

    preferred_location = candidate.get("preferred_location")
    if preferred_location and job.get("location"):
        if preferred_location.lower() in job["location"].lower():
            score += 10

    return {
        "match_score": min(score, 100),
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
    }


def get_queue_stats(cursor) -> Dict[str, int]:
    cursor.execute(
        """
        SELECT
          COUNT(*) FILTER (WHERE run_status = 'queued') AS queued,
          COUNT(*) FILTER (WHERE run_status = 'running') AS running,
          COUNT(*) FILTER (WHERE run_status = 'needs_manual_action') AS needs_manual_action,
          COUNT(*) FILTER (WHERE run_status = 'failed') AS failed
        FROM ai_agent_runs
        WHERE run_type IN ('external_apply', 'external_apply_retry')
        """
    )
    row = cursor.fetchone() or {}
    return {
        "queued": int(row.get("queued") or 0),
        "running": int(row.get("running") or 0),
        "needs_manual_action": int(row.get("needs_manual_action") or 0),
        "failed": int(row.get("failed") or 0),
    }


def claim_next_queued_run(cursor) -> Optional[Dict[str, Any]]:
    cursor.execute(
        """
        SELECT
          aar.agent_run_id,
          aar.candidate_id,
          aar.external_job_id,
          aar.requested_by_user_id,
          aar.run_type,
          aar.attempt_count,
          aar.max_attempts,
          c.skills,
          c.experience_years,
          c.preferred_role,
          c.preferred_location,
          ej.job_title,
          ej.company_name,
          ej.source_platform,
          ej.job_url,
          ej.apply_mode,
          ej.required_skills,
          ej.location
        FROM ai_agent_runs aar
        JOIN candidates c ON c.candidate_id = aar.candidate_id
        JOIN external_jobs ej ON ej.external_job_id = aar.external_job_id
        WHERE aar.run_status = 'queued'
        AND (aar.next_attempt_at IS NULL OR aar.next_attempt_at <= CURRENT_TIMESTAMP)
        AND (aar.locked_at IS NULL OR aar.locked_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes')
        ORDER BY COALESCE(aar.queue_priority, 5) ASC, aar.created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
        """
    )
    run = cursor.fetchone()

    if not run:
        return None

    cursor.execute(
        """
        UPDATE ai_agent_runs
        SET run_status = 'running',
            current_step = 'worker_claimed',
            locked_by = %s,
            locked_at = CURRENT_TIMESTAMP,
            last_heartbeat_at = CURRENT_TIMESTAMP,
            attempt_count = COALESCE(attempt_count, 0) + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE agent_run_id = %s
        """,
        (WORKER_NAME, run["agent_run_id"]),
    )

    add_step(
        cursor,
        run["agent_run_id"],
        "worker_claimed",
        1,
        "Python worker claimed this queued agent run for processing.",
        metadata={"worker_name": WORKER_NAME},
    )

    return run


@app.get("/queue/stats")
def queue_stats():
    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                stats = get_queue_stats(cursor)

        return {
            "service": "hirepilot-ai-agent-worker",
            "worker_name": WORKER_NAME,
            "status": "online",
            "queue": stats,
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@app.post("/queue/claim-next")
def queue_claim_next():
    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                run = claim_next_queued_run(cursor)
                conn.commit()

        return {
            "message": "Queued run claimed" if run else "No queued run available",
            "claimed": bool(run),
            "agent_run": serialize_row(run),
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@app.get("/health")
def health():
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()

        database_connected = True
    except Exception as error:
        database_connected = False
        return {
            "service": "hirepilot-ai-agent-worker",
            "worker_name": WORKER_NAME,
            "status": "degraded",
            "database_connected": database_connected,
            "error": str(error),
            "crawl4ai": get_crawl4ai_status(),
        }

    return {
        "service": "hirepilot-ai-agent-worker",
        "worker_name": WORKER_NAME,
        "status": "online",
        "database_connected": database_connected,
        "mode": "safe_simulation",
        "browser_automation": get_playwright_status(),
        "crawl4ai": get_crawl4ai_status(),
    }


@app.post("/discovery/crawl4ai-demo")
def crawl4ai_demo_discovery():
    if not get_crawl4ai_status()["available"]:
        raise HTTPException(
            status_code=503,
            detail=(
                "Crawl4AI is unavailable. Run: pip install -r requirements.txt "
                "and then crawl4ai-setup."
            ),
        )

    try:
        jobs = run_crawl4ai_demo_discovery_isolated()
        return {
            "success": True,
            "message": "Crawl4AI safe raw HTML demo discovery completed",
            "discovered_count": len(jobs),
            "mode": "safe_raw_html_discovery",
            "real_web_crawl": False,
            "jobs": jobs,
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/browser/smoke-test")
def browser_smoke_test(payload: BrowserSmokePayload):
    """
    Safe browser smoke test endpoint.

    This endpoint intentionally verifies Playwright/Chromium only and returns
    the browser result to the Node backend. The backend owns timeline writes
    for this smoke test, so a PostgreSQL write issue inside the worker cannot
    hide a successful browser launch behind a generic 500 response.
    """
    try:
        result = run_playwright_safe_form_fill_isolated()

        return {
            "message": "Playwright safe browser automation smoke test completed",
            "success": True,
            "agent_run_id": payload.agent_run_id,
            "candidate_id": payload.candidate_id,
            "result": result,
        }
    except Exception as error:
        error_message = str(error) or repr(error) or "Unknown Playwright smoke test error"
        raise HTTPException(status_code=500, detail=error_message)


@app.post("/simulate-external-apply")
def simulate_external_apply(payload: ExternalApplyPayload):
    try:
        candidate_profile = build_safe_candidate_profile(payload)

        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute(
                    """
                    UPDATE ai_agent_runs
                    SET locked_by = %s,
                        locked_at = COALESCE(locked_at, CURRENT_TIMESTAMP),
                        last_heartbeat_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE agent_run_id = %s
                    """,
                    (WORKER_NAME, payload.agent_run_id),
                )

                update_run(
                    cursor,
                    payload.agent_run_id,
                    run_status="running",
                    current_step="worker_received",
                    summary="Python worker accepted the external apply task.",
                    metadata={
                        "worker_name": WORKER_NAME,
                        "worker_mode": "safe_simulation",
                    },
                )

                add_step(
                    cursor,
                    payload.agent_run_id,
                    "worker_received",
                    1,
                    "Python AI worker accepted this external apply task.",
                    metadata={"worker_name": WORKER_NAME},
                )

                add_step(
                    cursor,
                    payload.agent_run_id,
                    "candidate_approval_received",
                    2,
                    "Candidate approved HirePilot to attempt this external application.",
                )

                add_step(
                    cursor,
                    payload.agent_run_id,
                    "profile_loaded",
                    3,
                    (
                        "Candidate profile loaded by Python worker. Safe fallback values were used for: "
                        + ", ".join(candidate_profile["fallback_fields"])
                        + "."
                        if candidate_profile["fallback_fields"]
                        else "Candidate profile and preferences loaded by Python worker."
                    ),
                    metadata={
                        "preferred_role": payload.preferred_role,
                        "preferred_location": payload.preferred_location,
                        "experience_years": payload.experience_years,
                        "fallback_fields": candidate_profile["fallback_fields"],
                        "used_profile_fallbacks": bool(candidate_profile["fallback_fields"]),
                    },
                )

                add_step(
                    cursor,
                    payload.agent_run_id,
                    "match_score_calculated",
                    4,
                    f"External job match score calculated as {payload.match_score}%.",
                    metadata={
                        "match_score": payload.match_score,
                        "matched_skills": payload.matched_skills,
                        "missing_skills": payload.missing_skills,
                    },
                )

                if payload.match_score < 40:
                    add_step(
                        cursor,
                        payload.agent_run_id,
                        "skipped_low_match",
                        5,
                        "Worker skipped this job because match score was below threshold.",
                        step_status="skipped",
                    )

                    log_attempt(
                        cursor,
                        payload.candidate_id,
                        payload.external_job_id,
                        None,
                        "external_apply_attempt",
                        "skipped_low_match",
                        payload.source_platform,
                        "External job match score is too low for auto apply",
                        {
                            "match_score": payload.match_score,
                            "apply_mode": payload.apply_mode,
                            "worker_name": WORKER_NAME,
                            "agent_run_id": payload.agent_run_id,
                        },
                    )

                    update_run(
                        cursor,
                        payload.agent_run_id,
                        run_status="skipped",
                        current_step="skipped_low_match",
                        summary="Python worker skipped this external job because match score was too low.",
                        error_message="External job match score is too low for auto apply",
                        metadata={"match_score": payload.match_score, "worker_name": WORKER_NAME},
                        completed=True,
                    )

                    conn.commit()
                    return {
                        "message": "External job skipped because match score is too low",
                        "outcome": "skipped_low_match",
                        "run_status": "skipped",
                        "used_worker": True,
                    }

                cursor.execute(
                    """
                    SELECT external_application_id, application_status
                    FROM external_applications
                    WHERE candidate_id = %s
                    AND external_job_id = %s
                    """,
                    (payload.candidate_id, payload.external_job_id),
                )
                existing = cursor.fetchone()

                retry_existing_application = None

                if existing:
                    retryable_statuses = {"Pending", "Cancelled", "Failed"}
                    can_retry_existing = (
                        payload.force_retry
                        and existing["application_status"] in retryable_statuses
                    )

                    if can_retry_existing:
                        retry_existing_application = existing

                        add_step(
                            cursor,
                            payload.agent_run_id,
                            "retry_existing_application",
                            5,
                            "Worker will retry this non-final external application record.",
                            metadata={
                                "external_application_id": existing["external_application_id"],
                                "previous_status": existing["application_status"],
                                "retry_source_agent_run_id": payload.retry_source_agent_run_id,
                            },
                        )
                    else:
                        add_step(
                            cursor,
                            payload.agent_run_id,
                            "duplicate_application_detected",
                            5,
                            "Worker found an existing external application and did not create a duplicate.",
                            step_status="skipped",
                            metadata={
                                "external_application_id": existing["external_application_id"],
                                "existing_status": existing["application_status"],
                            },
                        )

                        log_attempt(
                            cursor,
                            payload.candidate_id,
                            payload.external_job_id,
                            existing["external_application_id"],
                            "external_apply_retry" if payload.force_retry else "external_apply_attempt",
                            "skipped_duplicate",
                            payload.source_platform,
                            "External application already exists",
                            {
                                "existing_status": existing["application_status"],
                                "match_score": payload.match_score,
                                "apply_mode": payload.apply_mode,
                                "worker_name": WORKER_NAME,
                                "agent_run_id": payload.agent_run_id,
                                "force_retry": payload.force_retry,
                                "retry_source_agent_run_id": payload.retry_source_agent_run_id,
                            },
                        )

                        update_run(
                            cursor,
                            payload.agent_run_id,
                            run_status="skipped",
                            current_step="duplicate_application_detected",
                            summary="Python worker skipped external apply because application already exists.",
                            external_application_id=existing["external_application_id"],
                            metadata={
                                "existing_status": existing["application_status"],
                                "match_score": payload.match_score,
                                "worker_name": WORKER_NAME,
                                "force_retry": payload.force_retry,
                            },
                            completed=True,
                        )

                        conn.commit()
                        return {
                            "message": "External application already exists",
                            "outcome": "skipped_duplicate",
                            "run_status": "skipped",
                            "external_application_id": existing["external_application_id"],
                            "application_status": existing["application_status"],
                            "used_worker": True,
                        }

                safe_browser_apply_modes = {"easy_apply", "safe_browser_apply"}
                can_auto_complete = (
                    payload.apply_mode in safe_browser_apply_modes
                    and payload.match_score >= 60
                )
                application_status = "Applied" if can_auto_complete else "Pending"
                failure_reason = None if can_auto_complete else (
                    "Manual action needed: external portal may require questions, login, CAPTCHA, or candidate review."
                )
                browser_result: Optional[Dict[str, Any]] = None

                add_step(
                    cursor,
                    payload.agent_run_id,
                    "external_portal_assessed",
                    5,
                    "Python worker assessed the external portal requirements.",
                    metadata={
                        "apply_mode": payload.apply_mode,
                        "can_auto_complete": can_auto_complete,
                        "worker_mode": "safe_browser_apply" if can_auto_complete else "safe_simulation",
                        "real_external_submission": False,
                    },
                )

                if can_auto_complete:
                    add_step(
                        cursor,
                        payload.agent_run_id,
                        "browser_automation_started",
                        6,
                        "Python worker started safe dummy browser automation for this external apply.",
                        step_status="running",
                        metadata={
                            "automation_mode": "safe_dummy_external_apply",
                            "real_external_submission": False,
                        },
                    )
                    update_run(
                        cursor,
                        payload.agent_run_id,
                        run_status="running",
                        current_step="safe_browser_apply_started",
                        summary="Python worker started safe dummy browser automation for external apply.",
                        metadata={
                            "apply_mode": payload.apply_mode,
                            "automation_mode": "safe_dummy_external_apply",
                            "real_external_submission": False,
                        },
                    )
                    conn.commit()

                    try:
                        browser_result = run_playwright_external_apply_isolated(
                            full_name=candidate_profile["full_name"],
                            email=candidate_profile["email"],
                            phone=candidate_profile["phone"],
                            location=candidate_profile["location"],
                            job_title=payload.job_title,
                            company_name=payload.company_name,
                            experience_years=candidate_profile["experience_years"],
                            skills=candidate_profile["skills"],
                            resume_filename=candidate_profile["resume_filename"],
                            professional_summary=candidate_profile["professional_summary"],
                        )
                    except Exception as browser_error:
                        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as failure_cursor:
                            add_step(
                                failure_cursor,
                                payload.agent_run_id,
                                "browser_automation_failed",
                                7,
                                "Safe dummy browser automation failed before external application could be marked Applied.",
                                step_status="failed",
                                metadata={
                                    "error": str(browser_error),
                                    "real_external_submission": False,
                                },
                            )
                            log_attempt(
                                failure_cursor,
                                payload.candidate_id,
                                payload.external_job_id,
                                None,
                                "external_apply_retry" if payload.force_retry else "external_apply_attempt",
                                "failed",
                                payload.source_platform,
                                str(browser_error),
                                {
                                    "match_score": payload.match_score,
                                    "apply_mode": payload.apply_mode,
                                    "worker_name": WORKER_NAME,
                                    "agent_run_id": payload.agent_run_id,
                                    "automation_mode": "safe_dummy_external_apply",
                                    "real_external_submission": False,
                                },
                            )
                            update_run(
                                failure_cursor,
                                payload.agent_run_id,
                                run_status="failed",
                                current_step="browser_automation_failed",
                                summary="Safe dummy browser automation failed during external apply.",
                                error_message=str(browser_error),
                                metadata={
                                    "worker_name": WORKER_NAME,
                                    "automation_mode": "safe_dummy_external_apply",
                                    "real_external_submission": False,
                                },
                                completed=True,
                            )
                            conn.commit()

                        return {
                            "message": "Safe dummy browser automation failed",
                            "outcome": "browser_automation_failed",
                            "run_status": "failed",
                            "used_worker": True,
                        }

                    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as browser_cursor:
                        add_step(
                            browser_cursor,
                            payload.agent_run_id,
                            "dummy_portal_opened",
                            7,
                            "Playwright opened the safe dummy external job portal.",
                            metadata={
                                "portal": browser_result.get("portal"),
                                "real_external_submission": False,
                            },
                        )
                        add_step(
                            browser_cursor,
                            payload.agent_run_id,
                            "application_form_filled",
                            8,
                            "Playwright filled the dummy external application form with safe test data.",
                            metadata={
                                "role": payload.job_title,
                                "company_name": payload.company_name,
                                "matched_skills": payload.matched_skills,
                                "profile_fields_used": [
                                    "full_name",
                                    "email",
                                    "phone",
                                    "current_location",
                                    "skills",
                                    "experience_years",
                                    "preferred_role",
                                    "resume_filename",
                                    "professional_summary",
                                ],
                                "contains_real_submission": False,
                            },
                        )
                        add_step(
                            browser_cursor,
                            payload.agent_run_id,
                            "resume_upload_simulated",
                            9,
                            "Resume upload was simulated with a filename only. No real external portal upload occurred.",
                            metadata={
                                "resume_filename": candidate_profile["resume_filename"],
                                "real_resume_upload": False,
                            },
                        )
                        add_step(
                            browser_cursor,
                            payload.agent_run_id,
                            "dummy_portal_submitted",
                            10,
                            "Playwright clicked submit on the safe dummy external portal only.",
                            metadata={
                                "result_text": browser_result.get("result_text"),
                                "real_external_submission": False,
                            },
                        )

                if retry_existing_application:
                    cursor.execute(
                        """
                        UPDATE external_applications
                        SET application_status = %s,
                            failure_reason = %s,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE external_application_id = %s
                        AND candidate_id = %s
                        RETURNING *
                        """,
                        (
                            application_status,
                            failure_reason,
                            retry_existing_application["external_application_id"],
                            payload.candidate_id,
                        ),
                    )
                else:
                    cursor.execute(
                        """
                        INSERT INTO external_applications (
                          candidate_id,
                          external_job_id,
                          application_status,
                          failure_reason
                        )
                        VALUES (%s, %s, %s, %s)
                        RETURNING *
                        """,
                        (
                            payload.candidate_id,
                            payload.external_job_id,
                            application_status,
                            failure_reason,
                        ),
                    )

                application = cursor.fetchone()

                add_step(
                    cursor,
                    payload.agent_run_id,
                    "application_record_created",
                    11 if can_auto_complete else 6,
                    f"External application record created with status {application_status}.",
                    metadata={
                        "external_application_id": application["external_application_id"],
                        "application_status": application_status,
                        "automation_mode": "safe_dummy_external_apply" if can_auto_complete else "manual_fallback",
                    },
                )

                if can_auto_complete:
                    add_step(
                        cursor,
                        payload.agent_run_id,
                        "browser_automation_completed",
                        12,
                        "Safe dummy browser automation completed and external application was marked Applied.",
                        metadata={
                            "worker_name": WORKER_NAME,
                            "browser_result": browser_result or {},
                            "real_external_submission": False,
                        },
                    )

                log_attempt(
                    cursor,
                    payload.candidate_id,
                    payload.external_job_id,
                    application["external_application_id"],
                    "external_apply_retry" if payload.force_retry else "external_apply_attempt",
                    "auto_applied" if can_auto_complete else "pending_manual_action",
                    payload.source_platform,
                    failure_reason,
                    {
                        "match_score": payload.match_score,
                        "matched_skills": payload.matched_skills,
                        "missing_skills": payload.missing_skills,
                        "apply_mode": payload.apply_mode,
                        "worker_name": WORKER_NAME,
                        "agent_run_id": payload.agent_run_id,
                        "automation_mode": "safe_dummy_external_apply" if can_auto_complete else "manual_fallback",
                        "real_external_submission": False,
                    },
                )

                run_status = "completed" if can_auto_complete else "needs_manual_action"
                summary = (
                    "Python worker completed safe dummy browser external apply."
                    if can_auto_complete
                    else "Python worker determined this external application needs manual completion."
                )

                update_run(
                    cursor,
                    payload.agent_run_id,
                    run_status=run_status,
                    current_step="browser_automation_completed" if can_auto_complete else "waiting_for_candidate",
                    summary=summary,
                    external_application_id=application["external_application_id"],
                    metadata={
                        "match_score": payload.match_score,
                        "matched_skills": payload.matched_skills,
                        "missing_skills": payload.missing_skills,
                        "apply_mode": payload.apply_mode,
                        "worker_name": WORKER_NAME,
                        "used_python_worker": True,
                        "force_retry": payload.force_retry,
                        "retry_source_agent_run_id": payload.retry_source_agent_run_id,
                        "automation_mode": "safe_dummy_external_apply" if can_auto_complete else "manual_fallback",
                        "browser_result": browser_result or {},
                        "real_external_submission": False,
                    },
                    completed=True,
                )

                conn.commit()

                return {
                    "message": (
                        "External application completed through safe dummy browser automation"
                        if can_auto_complete
                        else "External application needs manual completion"
                    ),
                    "outcome": "auto_applied" if can_auto_complete else "pending_manual_action",
                    "run_status": run_status,
                    "externalApplication": serialize_row(application),
                    "used_worker": True,
                    "browser_automation_used": can_auto_complete,
                }
    except Exception as error:
        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    update_run(
                        cursor,
                        payload.agent_run_id,
                        run_status="failed",
                        current_step="worker_failed",
                        summary="Python worker failed while simulating external apply.",
                        error_message=str(error),
                        metadata={"worker_name": WORKER_NAME},
                        completed=True,
                    )
                    conn.commit()
        except Exception:
            pass

        raise HTTPException(status_code=500, detail=str(error))
