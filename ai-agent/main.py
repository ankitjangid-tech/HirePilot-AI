from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
import json
import os

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
    preferred_role: Optional[str] = None
    preferred_location: Optional[str] = None
    experience_years: Optional[int] = None
    force_retry: bool = False
    retry_source_agent_run_id: Optional[int] = None


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
        }

    return {
        "service": "hirepilot-ai-agent-worker",
        "worker_name": WORKER_NAME,
        "status": "online",
        "database_connected": database_connected,
        "mode": "safe_simulation",
    }


@app.post("/simulate-external-apply")
def simulate_external_apply(payload: ExternalApplyPayload):
    try:
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
                    "Candidate profile and preferences loaded by Python worker.",
                    metadata={
                        "preferred_role": payload.preferred_role,
                        "preferred_location": payload.preferred_location,
                        "experience_years": payload.experience_years,
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

                can_auto_complete = payload.apply_mode == "easy_apply" and payload.match_score >= 60
                application_status = "Applied" if can_auto_complete else "Pending"
                failure_reason = None if can_auto_complete else (
                    "Manual action needed: external portal may require questions, login, CAPTCHA, or candidate review."
                )

                add_step(
                    cursor,
                    payload.agent_run_id,
                    "external_portal_assessed",
                    5,
                    "Python worker assessed the external portal requirements.",
                    metadata={
                        "apply_mode": payload.apply_mode,
                        "can_auto_complete": can_auto_complete,
                        "worker_mode": "safe_simulation",
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
                    6,
                    f"External application record created with status {application_status}.",
                    metadata={
                        "external_application_id": application["external_application_id"],
                        "application_status": application_status,
                    },
                )

                if can_auto_complete:
                    add_step(
                        cursor,
                        payload.agent_run_id,
                        "worker_simulated_submit",
                        7,
                        "Python worker simulated a safe easy-apply submission.",
                        metadata={"worker_name": WORKER_NAME},
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
                    },
                )

                run_status = "completed" if can_auto_complete else "needs_manual_action"
                summary = (
                    "Python worker simulated external easy apply successfully."
                    if can_auto_complete
                    else "Python worker determined this external application needs manual completion."
                )

                update_run(
                    cursor,
                    payload.agent_run_id,
                    run_status=run_status,
                    current_step="completed" if can_auto_complete else "waiting_for_candidate",
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
                    },
                    completed=True,
                )

                conn.commit()

                return {
                    "message": (
                        "External application submitted by Python worker simulation"
                        if can_auto_complete
                        else "External application needs manual completion"
                    ),
                    "outcome": "auto_applied" if can_auto_complete else "pending_manual_action",
                    "run_status": run_status,
                    "externalApplication": serialize_row(application),
                    "used_worker": True,
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
