const axios = require("axios");
const pool = require("../config/db");
const { compareSkills, normalizeSkills } = require("../services/matchingService");

const MATCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "full",
  "in",
  "of",
  "or",
  "part",
  "remote",
  "the",
  "time",
  "to",
  "with",
]);

const matchTokens = (value) =>
  String(value || "")
    .toLowerCase()
    .match(/[a-z0-9+#.]+/g)
    ?.filter((token) => token.length > 1 && !MATCH_STOP_WORDS.has(token)) || [];

const textContainsSkill = (searchableText, searchableTokens, skill) => {
  const skillLabel = String(skill?.label || "").trim().toLowerCase();
  if (!skillLabel) {
    return false;
  }

  const skillTokens = matchTokens(skillLabel);
  if (skillTokens.length === 1 && skillTokens[0].length <= 3) {
    return searchableTokens.has(skillTokens[0]);
  }

  const compactSkill = skillLabel.replace(/[^a-z0-9+#]/g, "");
  const compactText = searchableText.replace(/[^a-z0-9+#]/g, "");
  return compactSkill.length >= 2 && compactText.includes(compactSkill);
};

const calculateExternalMatch = (candidate, job) => {
  const usableRequiredSkills = normalizeSkills(job.required_skills).filter(
    (skill) =>
      !["n/a", "na", "none", "not available", "not specified", "unknown"].includes(
        skill.key
      )
  );
  const comparison = compareSkills(
    candidate.skills,
    usableRequiredSkills.map((skill) => skill.label)
  );
  const jobSearchText = `${job.job_title || ""} ${job.job_description || ""}`
    .trim()
    .toLowerCase();
  const jobSearchTokens = new Set(matchTokens(jobSearchText));
  const fallbackSkillMatches = comparison.candidateSkills.filter((skill) =>
    textContainsSkill(jobSearchText, jobSearchTokens, skill)
  );
  const matchedSkills = Array.from(
    new Map(
      [...comparison.matchedSkills, ...fallbackSkillMatches].map((skill) => [
        skill.key,
        skill.label,
      ])
    ).values()
  );
  const missingSkills = comparison.missingSkills.map((skill) => skill.label);
  const directSkillScore = comparison.requiredCount
    ? Math.round((comparison.matchedCount / comparison.requiredCount) * 60)
    : 0;
  const fallbackOnlyCount = fallbackSkillMatches.filter(
    (fallbackSkill) =>
      !comparison.matchedSkills.some(
        (matchedSkill) => matchedSkill.key === fallbackSkill.key
      )
  ).length;
  const fallbackSkillScore = Math.min(fallbackOnlyCount * 10, 30);

  const roleTokens = Array.from(new Set(matchTokens(candidate.preferred_role)));
  const matchedRoleTokens = roleTokens.filter((token) =>
    jobSearchTokens.has(token)
  );
  const normalizedRole = roleTokens.join(" ");
  const normalizedJobText = matchTokens(jobSearchText).join(" ");
  const roleScore =
    normalizedRole && normalizedJobText.includes(normalizedRole)
      ? 30
      : roleTokens.length
      ? Math.round((matchedRoleTokens.length / roleTokens.length) * 30)
      : 0;

  let score = directSkillScore + fallbackSkillScore + roleScore;

  if (
    candidate.preferred_location &&
    job.location &&
    job.location.toLowerCase().includes(candidate.preferred_location.toLowerCase())
  ) {
    score += 5;
  }

  if (
    Number(job.experience_required) > 0 &&
    Number(candidate.experience_years) >= Number(job.experience_required)
  ) {
    score += 5;
  }

  const matchScore = Math.min(Math.max(Math.round(score), 0), 100);
  const hasMatchSignals = Boolean(
    comparison.requiredCount ||
      roleTokens.length ||
      fallbackSkillMatches.length ||
      job.job_description
  );
  const matchLabel =
    matchScore >= 70
      ? "Strong match"
      : matchScore >= 40
      ? "Good match"
      : matchScore > 0 || hasMatchSignals
      ? "Low match"
      : "Match unavailable";

  return {
    match_score: matchScore,
    match_label: matchLabel,
    match_level:
      matchLabel === "Strong match"
        ? "strong"
        : matchLabel === "Good match"
        ? "good"
        : matchLabel === "Low match"
        ? "low"
        : "unavailable",
    matched_skills: matchedSkills,
    missing_skills: missingSkills,
    matched_role_terms: matchedRoleTokens,
  };
};

const getResumeFilename = (resumeUrl) => {
  if (!resumeUrl) {
    return null;
  }

  const pathWithoutQuery = String(resumeUrl).split(/[?#]/, 1)[0];
  return pathWithoutQuery.split(/[\\/]/).filter(Boolean).pop() || null;
};

const getCandidateForUser = async (userId) => {
  const candidateResult = await pool.query(
    `SELECT
      c.candidate_id,
      c.skills,
      c.experience_years,
      c.preferred_role,
      c.preferred_location,
      c.expected_salary,
      c.phone_number,
      c.current_location,
      c.resume_url,
      c.professional_summary,
      u.full_name,
      u.email
     FROM candidates c
     JOIN users u
     ON u.user_id = c.user_id
     WHERE c.user_id = $1`,
    [userId]
  );

  return candidateResult.rows[0];
};

const isProfileIncomplete = (candidate) => {
  return (
    !candidate ||
    !candidate.skills ||
    candidate.experience_years === null ||
    candidate.experience_years === undefined ||
    Number(candidate.experience_years) < 0 ||
    !candidate.preferred_role ||
    !candidate.preferred_location ||
    !candidate.expected_salary
  );
};

const workerBaseUrl = () =>
  String(process.env.AI_WORKER_URL || "http://localhost:8000").replace(/\/$/, "");

const isWorkerEnabled = () =>
  String(process.env.AI_WORKER_ENABLED || "false").toLowerCase() === "true";

const shouldQueueExternalRuns = () =>
  isWorkerEnabled() &&
  String(process.env.AI_AGENT_QUEUE_ENABLED || "true").toLowerCase() === "true";

const isDevelopmentEndpointEnabled = () =>
  ["development", "test"].includes(
    String(process.env.NODE_ENV || "development").toLowerCase()
  );

const isFinalRunStatus = (status) =>
  ["completed", "failed", "skipped", "cancelled"].includes(status);

const RETRYABLE_APPLICATION_STATUSES = ["Pending", "Cancelled", "Failed"];
const ACTIVE_AGENT_RUN_STATUSES = ["queued", "running", "needs_manual_action"];
const RETRYABLE_AGENT_RUN_STATUSES = [
  "failed",
  "needs_manual_action",
  "skipped",
  "cancelled",
];

const logAgentAttempt = async ({
  candidate_id,
  external_job_id = null,
  external_application_id = null,
  action_type,
  attempt_status,
  source_platform = null,
  failure_reason = null,
  metadata = {},
}) => {
  try {
    await pool.query(
      `INSERT INTO agent_attempt_logs (
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
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        candidate_id,
        external_job_id,
        external_application_id,
        "external_apply_agent",
        action_type,
        attempt_status,
        source_platform,
        failure_reason,
        JSON.stringify(metadata || {}),
      ]
    );
  } catch (error) {
    console.log("AGENT LOG ERROR:", error.message);
  }
};

const createAgentRun = async ({
  candidate_id,
  external_job_id = null,
  external_application_id = null,
  requested_by_user_id = null,
  run_type = "external_apply",
  run_status = "running",
  agent_name = "external_apply_orchestrator",
  source_platform = null,
  current_step = "queued",
  metadata = {},
  queue_priority = 5,
  max_attempts = 3,
}) => {
  try {
    const result = await pool.query(
      `INSERT INTO ai_agent_runs (
        candidate_id,
        external_job_id,
        external_application_id,
        agent_name,
        run_type,
        run_status,
        source_platform,
        requested_by_user_id,
        approval_status,
        current_step,
        metadata,
        queue_priority,
        next_attempt_at,
        attempt_count,
        max_attempts,
        started_at
       )
       VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb,
        $12, CURRENT_TIMESTAMP, 0, $13, CURRENT_TIMESTAMP
       )
       RETURNING agent_run_id`,
      [
        candidate_id,
        external_job_id,
        external_application_id,
        agent_name,
        run_type,
        run_status,
        source_platform,
        requested_by_user_id,
        "candidate_approved",
        current_step,
        JSON.stringify(metadata || {}),
        queue_priority,
        max_attempts,
      ]
    );

    return result.rows[0].agent_run_id;
  } catch (error) {
    console.log("AGENT RUN CREATE ERROR:", error.message);
    return null;
  }
};

const addAgentRunStep = async ({
  agent_run_id,
  step_name,
  step_status = "completed",
  step_order = 1,
  details = null,
  metadata = {},
}) => {
  if (!agent_run_id) {
    return;
  }

  try {
    await pool.query(
      `INSERT INTO ai_agent_run_steps (
        agent_run_id,
        step_name,
        step_status,
        step_order,
        details,
        metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        agent_run_id,
        step_name,
        step_status,
        step_order,
        details,
        JSON.stringify(metadata || {}),
      ]
    );
  } catch (error) {
    console.log("AGENT RUN STEP ERROR:", error.message);
  }
};

const finishAgentRun = async ({
  agent_run_id,
  run_status,
  current_step,
  summary = null,
  error_message = null,
  external_application_id = null,
  metadata = {},
}) => {
  if (!agent_run_id) {
    return;
  }

  try {
    await pool.query(
      `UPDATE ai_agent_runs
       SET run_status = $1,
           current_step = $2,
           summary = $3,
           error_message = $4,
           external_application_id = COALESCE($5, external_application_id),
           metadata = COALESCE(metadata, '{}'::jsonb) || $6::jsonb,
           locked_by = CASE WHEN $8 THEN NULL ELSE locked_by END,
           locked_at = CASE WHEN $8 THEN NULL ELSE locked_at END,
           last_heartbeat_at = CURRENT_TIMESTAMP,
           queue_error = $9,
           completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE agent_run_id = $7`,
      [
        run_status,
        current_step,
        summary,
        error_message,
        external_application_id,
        JSON.stringify(metadata || {}),
        agent_run_id,
        isFinalRunStatus(run_status) || run_status === "needs_manual_action",
        error_message,
      ]
    );
  } catch (error) {
    console.log("AGENT RUN FINISH ERROR:", error.message);
  }
};

const syncResolvedManualAgentRuns = async (candidateId, externalApplicationId = null) => {
  try {
    await pool.query(
      `UPDATE ai_agent_runs aar
       SET run_status = CASE
             WHEN ea.application_status = 'Applied' THEN 'completed'
             WHEN ea.application_status = 'Cancelled' THEN 'cancelled'
             WHEN ea.application_status = 'Failed' THEN 'failed'
             ELSE aar.run_status
           END,
           current_step = CASE
             WHEN ea.application_status = 'Applied' THEN 'manual_completed'
             WHEN ea.application_status = 'Cancelled' THEN 'cancelled'
             WHEN ea.application_status = 'Failed' THEN 'failed'
             ELSE aar.current_step
           END,
           summary = CASE
             WHEN ea.application_status = 'Applied'
               THEN 'Manual external application was completed by candidate.'
             WHEN ea.application_status = 'Cancelled'
               THEN 'Manual external application was cancelled.'
             WHEN ea.application_status = 'Failed'
               THEN 'Manual external application failed.'
             ELSE aar.summary
           END,
           metadata = COALESCE(aar.metadata, '{}'::jsonb) || jsonb_build_object(
             'resolved_by_external_application_status', ea.application_status,
             'resolved_at', CURRENT_TIMESTAMP
           ),
           locked_by = NULL,
           locked_at = NULL,
           last_heartbeat_at = CURRENT_TIMESTAMP,
           completed_at = COALESCE(aar.completed_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       FROM external_applications ea
       WHERE aar.external_application_id = ea.external_application_id
       AND aar.candidate_id = $1
       AND aar.run_status = 'needs_manual_action'
       AND ea.application_status IN ('Applied', 'Cancelled', 'Failed')
       AND ($2::int IS NULL OR ea.external_application_id = $2)`,
      [candidateId, externalApplicationId]
    );
  } catch (error) {
    console.log("AGENT RUN SYNC ERROR:", error.message);
  }
};

const callPythonWorker = async ({
  agentRunId,
  candidate,
  job,
  match,
  userId,
  forceRetry = false,
  retrySourceAgentRunId = null,
}) => {
  if (!isWorkerEnabled()) {
    return null;
  }

  try {
    await pool.query(
      `UPDATE ai_agent_runs
       SET run_status = 'running',
           current_step = 'dispatching_to_python_worker',
           locked_by = $2,
           locked_at = COALESCE(locked_at, CURRENT_TIMESTAMP),
           last_heartbeat_at = CURRENT_TIMESTAMP,
           attempt_count = COALESCE(attempt_count, 0) + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE agent_run_id = $1`,
      [agentRunId, "node_backend_dispatcher"]
    );

    const response = await axios.post(
      `${workerBaseUrl()}/simulate-external-apply`,
      {
        agent_run_id: agentRunId,
        candidate_id: candidate.candidate_id,
        external_job_id: job.external_job_id,
        requested_by_user_id: userId,
        job_title: job.job_title,
        company_name: job.company_name,
        source_platform: job.source_platform,
        job_url: job.job_url,
        apply_mode: job.apply_mode,
        match_score: match.match_score,
        matched_skills: match.matched_skills,
        missing_skills: match.missing_skills,
        full_name: candidate.full_name,
        email: candidate.email,
        phone: candidate.phone_number,
        current_location: candidate.current_location,
        skills: candidate.skills,
        preferred_role: candidate.preferred_role,
        preferred_location: candidate.preferred_location,
        experience_years: candidate.experience_years,
        resume_filename: getResumeFilename(candidate.resume_url),
        professional_summary: candidate.professional_summary,
        force_retry: forceRetry,
        retry_source_agent_run_id: retrySourceAgentRunId,
      },
      {
        timeout: Number(process.env.AI_WORKER_TIMEOUT_MS || 15000),
      }
    );

    return response.data;
  } catch (error) {
    console.log(
      "PYTHON WORKER UNAVAILABLE, USING LOCAL FALLBACK:",
      error.response?.data || error.message
    );

    await addAgentRunStep({
      agent_run_id: agentRunId,
      step_name: "worker_unavailable_fallback",
      step_status: "failed",
      step_order: 1,
      details:
        "Python worker was enabled but unavailable. Node backend continued with local safe fallback.",
      metadata: {
        worker_url: workerBaseUrl(),
        error: error.message,
      },
    });

    await pool.query(
      `UPDATE ai_agent_runs
       SET queue_error = $2,
           locked_by = NULL,
           locked_at = NULL,
           last_heartbeat_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE agent_run_id = $1`,
      [agentRunId, error.message]
    );

    return null;
  }
};

const processExternalApplyLocally = async ({
  agentRunId,
  candidate,
  job,
  match,
  forceRetry = false,
  retrySourceAgentRunId = null,
}) => {
  await addAgentRunStep({
    agent_run_id: agentRunId,
    step_name: "candidate_approval_received",
    step_order: 2,
    details: "Candidate clicked Apply with HirePilot for this external job.",
  });

  await addAgentRunStep({
    agent_run_id: agentRunId,
    step_name: "profile_loaded",
    step_order: 3,
    details: "Candidate profile and preferences loaded for external matching.",
    metadata: {
      preferred_role: candidate.preferred_role,
      preferred_location: candidate.preferred_location,
      experience_years: candidate.experience_years,
    },
  });

  await addAgentRunStep({
    agent_run_id: agentRunId,
    step_name: "match_score_calculated",
    step_order: 4,
    details: `External job match score calculated as ${match.match_score}%.`,
    metadata: {
      match_score: match.match_score,
      matched_skills: match.matched_skills,
      missing_skills: match.missing_skills,
    },
  });

  const canAutoComplete = job.apply_mode === "easy_apply" && match.match_score >= 60;
  const applicationStatus = canAutoComplete ? "Applied" : "Pending";
  const failureReason = canAutoComplete
    ? null
    : "Manual action needed: external portal may require questions, login, CAPTCHA, or candidate review.";

  await addAgentRunStep({
    agent_run_id: agentRunId,
    step_name: "external_portal_assessed",
    step_order: 5,
    details: canAutoComplete
      ? "External source is safe for simulated auto-apply."
      : "External source requires candidate review or manual completion.",
    metadata: {
      apply_mode: job.apply_mode,
      can_auto_complete: canAutoComplete,
      fallback_mode: "node_local_fallback",
    },
  });

  let application;

  if (forceRetry) {
    const retryApplicationResult = await pool.query(
      `SELECT external_application_id, application_status
       FROM external_applications
       WHERE candidate_id = $1
       AND external_job_id = $2
       AND application_status <> 'Applied'
       ORDER BY external_application_id DESC
       LIMIT 1`,
      [candidate.candidate_id, job.external_job_id]
    );

    if (retryApplicationResult.rows.length > 0) {
      await addAgentRunStep({
        agent_run_id: agentRunId,
        step_name: "retry_existing_application",
        step_order: 5,
        details:
          "Retry reused an existing non-final external application record.",
        metadata: {
          external_application_id:
            retryApplicationResult.rows[0].external_application_id,
          previous_status: retryApplicationResult.rows[0].application_status,
          retry_source_agent_run_id: retrySourceAgentRunId,
        },
      });

      application = await pool.query(
        `UPDATE external_applications
         SET application_status = $1,
             failure_reason = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE external_application_id = $3
         AND candidate_id = $4
         RETURNING *`,
        [
          applicationStatus,
          failureReason,
          retryApplicationResult.rows[0].external_application_id,
          candidate.candidate_id,
        ]
      );
    }
  }

  if (!application) {
    application = await pool.query(
      `INSERT INTO external_applications (
        candidate_id,
        external_job_id,
        application_status,
        failure_reason
       )
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [candidate.candidate_id, job.external_job_id, applicationStatus, failureReason]
    );
  }

  await addAgentRunStep({
    agent_run_id: agentRunId,
    step_name: "application_record_created",
    step_order: 6,
    details: `External application record created with status ${applicationStatus}.`,
    metadata: {
      external_application_id: application.rows[0].external_application_id,
      application_status: applicationStatus,
    },
  });

  await logAgentAttempt({
    candidate_id: candidate.candidate_id,
    external_job_id: job.external_job_id,
    external_application_id: application.rows[0].external_application_id,
    action_type: "external_apply_attempt",
    attempt_status: canAutoComplete ? "auto_applied" : "pending_manual_action",
    source_platform: job.source_platform,
    failure_reason: failureReason,
    metadata: {
      match_score: match.match_score,
      matched_skills: match.matched_skills,
      missing_skills: match.missing_skills,
      apply_mode: job.apply_mode,
      agent_run_id: agentRunId,
      worker_mode: isWorkerEnabled() ? "node_fallback_after_worker_unavailable" : "node_local",
    },
  });

  await finishAgentRun({
    agent_run_id: agentRunId,
    run_status: canAutoComplete ? "completed" : "needs_manual_action",
    current_step: canAutoComplete ? "completed" : "waiting_for_candidate",
    summary: canAutoComplete
      ? "External application submitted through simulated easy apply."
      : "External application needs manual completion by candidate.",
    external_application_id: application.rows[0].external_application_id,
    metadata: {
      match_score: match.match_score,
      matched_skills: match.matched_skills,
      missing_skills: match.missing_skills,
      apply_mode: job.apply_mode,
      worker_mode: isWorkerEnabled() ? "node_fallback" : "node_local",
    },
  });

  return {
    message: canAutoComplete
      ? "External application submitted"
      : "External application needs manual completion",
    externalApplication: application.rows[0],
    canAutoComplete,
  };
};

const getMatchedExternalJobs = async (req, res) => {
  try {
    const candidate = await getCandidateForUser(req.user.user_id);

    if (!candidate) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    const jobsResult = await pool.query(
      `SELECT
        ej.external_job_id,
        ej.job_title,
        ej.company_name,
        ej.source_platform,
        ej.job_url,
        ej.required_skills,
        ej.experience_required,
        ej.location,
        ej.salary,
        ej.apply_mode,
        ej.review_status,
        ej.discovery_source,
        NULLIF(to_jsonb(ej)->>'job_description', '') AS job_description,
        ea.external_application_id,
        ea.application_status,
        ea.failure_reason,
        ea.applied_at
       FROM external_jobs ej
       LEFT JOIN external_applications ea
       ON ea.external_job_id = ej.external_job_id
       AND ea.candidate_id = $1
       WHERE ej.is_active = TRUE
       AND (ej.review_status IS NULL OR ej.review_status = 'approved')
       ORDER BY ej.external_job_id DESC`,
      [candidate.candidate_id]
    );

    const matchedExternalJobs = jobsResult.rows
      .map((job) => {
        const match = calculateExternalMatch(candidate, job);

        return {
          ...job,
          ...match,
          already_applied: Boolean(job.external_application_id),
        };
      })
      .sort(
        (a, b) =>
          b.match_score - a.match_score ||
          b.external_job_id - a.external_job_id
      );

    return res.status(200).json({
      matchedExternalJobs,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Unable to discover external jobs",
    });
  }
};

const getMyExternalApplications = async (req, res) => {
  try {
    const candidate = await getCandidateForUser(req.user.user_id);

    if (!candidate) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    const result = await pool.query(
      `SELECT
        ea.external_application_id,
        ea.external_job_id,
        ea.application_status,
        ea.failure_reason,
        ea.applied_at,
        ea.updated_at,
        ej.job_title,
        ej.company_name,
        ej.source_platform,
        ej.job_url,
        ej.required_skills,
        ej.location,
        ej.salary,
        ej.apply_mode
       FROM external_applications ea
       JOIN external_jobs ej
       ON ea.external_job_id = ej.external_job_id
       WHERE ea.candidate_id = $1
       ORDER BY ea.external_application_id DESC`,
      [candidate.candidate_id]
    );

    return res.status(200).json({
      externalApplications: result.rows,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Unable to fetch external applications",
    });
  }
};

const getExternalAgentLogs = async (req, res) => {
  try {
    const candidate = await getCandidateForUser(req.user.user_id);

    if (!candidate) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    const result = await pool.query(
      `SELECT
        aal.agent_attempt_id,
        aal.candidate_id,
        aal.external_job_id,
        aal.external_application_id,
        aal.agent_name,
        aal.action_type,
        aal.attempt_status,
        aal.source_platform,
        aal.failure_reason,
        aal.metadata,
        aal.created_at,
        ej.job_title,
        ej.company_name
       FROM agent_attempt_logs aal
       LEFT JOIN external_jobs ej
       ON ej.external_job_id = aal.external_job_id
       WHERE aal.candidate_id = $1
       ORDER BY aal.created_at DESC, aal.agent_attempt_id DESC
       LIMIT 25`,
      [candidate.candidate_id]
    );

    return res.status(200).json({
      agentLogs: result.rows,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Unable to fetch external agent activity",
    });
  }
};

const getExternalAgentRuns = async (req, res) => {
  try {
    const candidate = await getCandidateForUser(req.user.user_id);

    if (!candidate) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    await syncResolvedManualAgentRuns(candidate.candidate_id);

    const result = await pool.query(
      `SELECT
        aar.agent_run_id,
        aar.candidate_id,
        aar.external_job_id,
        aar.external_application_id,
        aar.agent_name,
        aar.run_type,
        aar.run_status,
        aar.source_platform,
        aar.approval_status,
        aar.current_step,
        ea.application_status AS external_application_status,
        ea.failure_reason AS external_application_failure_reason,
        aar.summary,
        aar.error_message,
        aar.metadata,
        aar.queue_priority,
        aar.locked_by,
        aar.locked_at,
        aar.last_heartbeat_at,
        aar.attempt_count,
        aar.max_attempts,
        aar.next_attempt_at,
        aar.queue_error,
        aar.started_at,
        aar.completed_at,
        aar.created_at,
        ej.job_title,
        ej.company_name,
        COALESCE(
          json_agg(
            json_build_object(
              'step_id', ars.step_id,
              'step_name', ars.step_name,
              'step_status', ars.step_status,
              'step_order', ars.step_order,
              'details', ars.details,
              'metadata', ars.metadata,
              'created_at', ars.created_at
            )
            ORDER BY ars.step_order ASC, ars.created_at ASC
          ) FILTER (WHERE ars.step_id IS NOT NULL),
          '[]'::json
        ) AS steps
       FROM ai_agent_runs aar
       LEFT JOIN external_jobs ej
       ON ej.external_job_id = aar.external_job_id
       LEFT JOIN external_applications ea
       ON ea.external_application_id = aar.external_application_id
       LEFT JOIN ai_agent_run_steps ars
       ON ars.agent_run_id = aar.agent_run_id
       WHERE aar.candidate_id = $1
       GROUP BY
        aar.agent_run_id,
        ej.job_title,
        ej.company_name,
        ea.application_status,
        ea.failure_reason
       ORDER BY aar.created_at DESC, aar.agent_run_id DESC
       LIMIT 15`,
      [candidate.candidate_id]
    );

    return res.status(200).json({
      agentRuns: result.rows,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Unable to fetch AI agent runs",
    });
  }
};

const getExternalWorkerHealth = async (req, res) => {
  if (!isWorkerEnabled()) {
    return res.status(200).json({
      worker_enabled: false,
      online: false,
      mode: "node_local_orchestration",
      message: "Python worker is disabled. Node backend will use local safe fallback.",
    });
  }

  try {
    const response = await axios.get(`${workerBaseUrl()}/health`, {
      timeout: Number(process.env.AI_WORKER_HEALTH_TIMEOUT_MS || 5000),
    });

    return res.status(200).json({
      worker_enabled: true,
      online: response.data?.status === "online",
      mode: "python_worker_stub",
      worker_url: workerBaseUrl(),
      worker: response.data,
    });
  } catch (error) {
    return res.status(200).json({
      worker_enabled: true,
      online: false,
      mode: "node_fallback_when_worker_offline",
      worker_url: workerBaseUrl(),
      message: "Python worker is configured but currently unavailable.",
      error: error.message,
    });
  }
};

const dispatchExternalApplyProcessing = async ({
  agentRunId,
  candidate,
  job,
  match,
  userId,
  forceRetry = false,
  retrySourceAgentRunId = null,
}) => {
  const workerResult = await callPythonWorker({
    agentRunId,
    candidate,
    job,
    match,
    userId,
    forceRetry,
    retrySourceAgentRunId,
  });

  if (workerResult) {
    return {
      usedWorker: true,
      workerResult,
      localResult: null,
    };
  }

  const localResult = await processExternalApplyLocally({
    agentRunId,
    candidate,
    job,
    match,
    forceRetry,
    retrySourceAgentRunId,
  });

  return {
    usedWorker: false,
    workerResult: null,
    localResult,
  };
};

const startBackgroundExternalApplyProcessing = ({
  agentRunId,
  candidate,
  job,
  match,
  userId,
  forceRetry = false,
  retrySourceAgentRunId = null,
}) => {
  setImmediate(async () => {
    try {
      await dispatchExternalApplyProcessing({
        agentRunId,
        candidate,
        job,
        match,
        userId,
        forceRetry,
        retrySourceAgentRunId,
      });
    } catch (error) {
      console.log("BACKGROUND AGENT RUN ERROR:", error.message);

      await addAgentRunStep({
        agent_run_id: agentRunId,
        step_name: "background_processing_failed",
        step_status: "failed",
        step_order: 101,
        details: "Background queue worker failed while processing this agent run.",
        metadata: { error: error.message },
      });

      await finishAgentRun({
        agent_run_id: agentRunId,
        run_status: "failed",
        current_step: "failed",
        summary: "Background external apply processing failed.",
        error_message: error.message,
      });
    }
  });
};

const executeExternalApplyAttempt = async ({
  userId,
  external_job_id,
  forceRetry = false,
  retrySourceAgentRunId = null,
}) => {
  let agentRunId = null;

  try {
    if (!external_job_id) {
      return {
        statusCode: 400,
        payload: { error: "external_job_id is required" },
      };
    }

    const candidate = await getCandidateForUser(userId);

    if (!candidate) {
      return {
        statusCode: 404,
        payload: { error: "Candidate profile not found" },
      };
    }

    if (isProfileIncomplete(candidate)) {
      return {
        statusCode: 400,
        payload: { error: "Please complete your profile before external apply" },
      };
    }

    const jobResult = await pool.query(
      `SELECT *
       FROM external_jobs
       WHERE external_job_id = $1
       AND is_active = TRUE
       AND (review_status IS NULL OR review_status = 'approved')`,
      [external_job_id]
    );

    if (jobResult.rows.length === 0) {
      return {
        statusCode: 404,
        payload: { error: "External job not found" },
      };
    }

    const job = jobResult.rows[0];
    const match = calculateExternalMatch(candidate, job);

    agentRunId = await createAgentRun({
      candidate_id: candidate.candidate_id,
      external_job_id,
      requested_by_user_id: userId,
      run_type: forceRetry ? "external_apply_retry" : "external_apply",
      run_status: isWorkerEnabled() ? "queued" : "running",
      agent_name: isWorkerEnabled()
        ? "external_apply_orchestrator_python_worker"
        : "external_apply_orchestrator",
      source_platform: job.source_platform,
      current_step: isWorkerEnabled()
        ? "queued_for_python_worker"
        : "candidate_approval_received",
      metadata: {
        job_title: job.job_title,
        company_name: job.company_name,
        apply_mode: job.apply_mode,
        worker_enabled: isWorkerEnabled(),
        queue_enabled: shouldQueueExternalRuns(),
        force_retry: forceRetry,
        retry_source_agent_run_id: retrySourceAgentRunId,
      },
    });

    if (agentRunId && isWorkerEnabled()) {
      await addAgentRunStep({
        agent_run_id: agentRunId,
        step_name: "queued_for_worker",
        step_status: "queued",
        step_order: 0,
        details: "AI agent run queued for Python worker processing.",
        metadata: {
          worker_url: workerBaseUrl(),
          queue_enabled: shouldQueueExternalRuns(),
        },
      });
    }

    if (match.match_score < 40) {
      await logAgentAttempt({
        candidate_id: candidate.candidate_id,
        external_job_id,
        action_type: forceRetry ? "external_apply_retry" : "external_apply_attempt",
        attempt_status: "skipped_low_match",
        source_platform: job.source_platform,
        failure_reason: "External job match score is too low for auto apply",
        metadata: {
          match_score: match.match_score,
          matched_skills: match.matched_skills,
          missing_skills: match.missing_skills,
          apply_mode: job.apply_mode,
          agent_run_id: agentRunId,
          retry_source_agent_run_id: retrySourceAgentRunId,
        },
      });

      await addAgentRunStep({
        agent_run_id: agentRunId,
        step_name: "skipped_low_match",
        step_status: "skipped",
        step_order: 1,
        details: "Agent skipped this external job because match score was below threshold.",
      });

      await finishAgentRun({
        agent_run_id: agentRunId,
        run_status: "skipped",
        current_step: "skipped_low_match",
        summary: "External job skipped because match score was too low.",
        error_message: "External job match score is too low for auto apply",
        metadata: {
          match_score: match.match_score,
          force_retry: forceRetry,
        },
      });

      return {
        statusCode: 400,
        payload: {
          error: "External job match score is too low for auto apply",
          agent_run_id: agentRunId,
        },
      };
    }

    const existing = await pool.query(
      `SELECT
        external_application_id,
        application_status
       FROM external_applications
       WHERE candidate_id = $1
       AND external_job_id = $2`,
      [candidate.candidate_id, external_job_id]
    );

    if (existing.rows.length > 0) {
      const existingApplication = existing.rows[0];
      const existingStatus = existingApplication.application_status;
      const canRetryExisting =
        forceRetry && RETRYABLE_APPLICATION_STATUSES.includes(existingStatus);

      if (!canRetryExisting) {
        await logAgentAttempt({
          candidate_id: candidate.candidate_id,
          external_job_id,
          external_application_id: existingApplication.external_application_id,
          action_type: forceRetry ? "external_apply_retry" : "external_apply_attempt",
          attempt_status: "skipped_duplicate",
          source_platform: job.source_platform,
          failure_reason: "External application already exists",
          metadata: {
            existing_status: existingStatus,
            match_score: match.match_score,
            apply_mode: job.apply_mode,
            agent_run_id: agentRunId,
            retry_source_agent_run_id: retrySourceAgentRunId,
          },
        });

        await addAgentRunStep({
          agent_run_id: agentRunId,
          step_name: "duplicate_application_detected",
          step_status: "skipped",
          step_order: 1,
          details:
            "Agent found an existing external application and did not create a duplicate.",
          metadata: {
            existing_status: existingStatus,
            external_application_id: existingApplication.external_application_id,
          },
        });

        await finishAgentRun({
          agent_run_id: agentRunId,
          run_status: "skipped",
          current_step: "duplicate_application_detected",
          summary: "External apply skipped because application already exists.",
          external_application_id: existingApplication.external_application_id,
          metadata: {
            existing_status: existingStatus,
            match_score: match.match_score,
          },
        });

        return {
          statusCode: 409,
          payload: {
            error: "External application already exists",
            external_application_id: existingApplication.external_application_id,
            application_status: existingStatus,
            agent_run_id: agentRunId,
          },
        };
      }
    }

    if (shouldQueueExternalRuns()) {
      startBackgroundExternalApplyProcessing({
        agentRunId,
        candidate,
        job,
        match,
        userId,
        forceRetry,
        retrySourceAgentRunId,
      });

      return {
        statusCode: 202,
        payload: {
          message: forceRetry
            ? "AI agent retry queued. Live progress will update shortly."
            : "AI agent run queued. Live progress will update shortly.",
          agent_run_id: agentRunId,
          queued: true,
          retried: forceRetry,
          external_job_id,
        },
      };
    }

    const processingResult = await dispatchExternalApplyProcessing({
      agentRunId,
      candidate,
      job,
      match,
      userId,
      forceRetry,
      retrySourceAgentRunId,
    });

    if (processingResult.workerResult) {
      const workerResult = processingResult.workerResult;

      if (workerResult.outcome === "skipped_low_match") {
        return {
          statusCode: 400,
          payload: { error: workerResult.message, agent_run_id: agentRunId },
        };
      }

      if (workerResult.outcome === "skipped_duplicate") {
        return {
          statusCode: 409,
          payload: {
            error: workerResult.message,
            external_application_id: workerResult.external_application_id,
            application_status: workerResult.application_status,
            agent_run_id: agentRunId,
          },
        };
      }

      return {
        statusCode: 200,
        payload: {
          message: forceRetry
            ? `Retry completed: ${workerResult.message}`
            : workerResult.message,
          externalApplication: {
            ...(workerResult.externalApplication || {}),
            job_title: job.job_title,
            company_name: job.company_name,
            source_platform: job.source_platform,
            job_url: job.job_url,
            match_score: match.match_score,
          },
          agent_run_id: agentRunId,
          used_worker: true,
          retried: forceRetry,
        },
      };
    }

    const localResult = processingResult.localResult;

    return {
      statusCode: 200,
      payload: {
        message: forceRetry
          ? `Retry completed: ${localResult.message}`
          : localResult.message,
        externalApplication: {
          ...localResult.externalApplication,
          job_title: job.job_title,
          company_name: job.company_name,
          source_platform: job.source_platform,
          job_url: job.job_url,
          match_score: match.match_score,
        },
        agent_run_id: agentRunId,
        used_worker: false,
        retried: forceRetry,
      },
    };
  } catch (error) {
    console.log(error);

    await finishAgentRun({
      agent_run_id: agentRunId,
      run_status: "failed",
      current_step: "failed",
      summary: "External apply orchestration failed.",
      error_message: error.message,
    });

    return {
      statusCode: 500,
      payload: { error: "External application failed" },
    };
  }
};

const applyExternalJob = async (req, res) => {
  const { external_job_id } = req.body;

  const result = await executeExternalApplyAttempt({
    userId: req.user.user_id,
    external_job_id,
    forceRetry: false,
  });

  return res.status(result.statusCode).json(result.payload);
};

const retryExternalAgentRun = async (req, res) => {
  try {
    const agentRunId = Number(req.params.agentRunId);

    if (!agentRunId) {
      return res.status(400).json({
        error: "Valid agent run id is required",
      });
    }

    const candidate = await getCandidateForUser(req.user.user_id);

    if (!candidate) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    const runResult = await pool.query(
      `SELECT
        aar.agent_run_id,
        aar.external_job_id,
        aar.external_application_id,
        aar.run_status,
        ej.is_active,
        ej.job_title,
        ej.company_name
       FROM ai_agent_runs aar
       LEFT JOIN external_jobs ej
       ON ej.external_job_id = aar.external_job_id
       WHERE aar.agent_run_id = $1
       AND aar.candidate_id = $2`,
      [agentRunId, candidate.candidate_id]
    );

    if (runResult.rows.length === 0) {
      return res.status(404).json({
        error: "Agent run not found",
      });
    }

    const run = runResult.rows[0];

    if (!run.external_job_id || run.is_active === false) {
      return res.status(400).json({
        error: "This agent run cannot be retried because the external job is unavailable",
      });
    }

    if (!RETRYABLE_AGENT_RUN_STATUSES.includes(run.run_status)) {
      return res.status(400).json({
        error: "Only failed, skipped, cancelled, or manual-action runs can be retried",
      });
    }

    const retryResult = await executeExternalApplyAttempt({
      userId: req.user.user_id,
      external_job_id: run.external_job_id,
      forceRetry: true,
      retrySourceAgentRunId: agentRunId,
    });

    return res.status(retryResult.statusCode).json(retryResult.payload);
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Unable to retry agent run",
    });
  }
};

const cancelExternalAgentRun = async (req, res) => {
  try {
    const agentRunId = Number(req.params.agentRunId);

    if (!agentRunId) {
      return res.status(400).json({
        error: "Valid agent run id is required",
      });
    }

    const candidate = await getCandidateForUser(req.user.user_id);

    if (!candidate) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    const runResult = await pool.query(
      `SELECT
        aar.agent_run_id,
        aar.external_job_id,
        aar.external_application_id,
        aar.run_status,
        aar.source_platform,
        ej.job_title,
        ej.company_name,
        ea.application_status
       FROM ai_agent_runs aar
       LEFT JOIN external_jobs ej
       ON ej.external_job_id = aar.external_job_id
       LEFT JOIN external_applications ea
       ON ea.external_application_id = aar.external_application_id
       WHERE aar.agent_run_id = $1
       AND aar.candidate_id = $2`,
      [agentRunId, candidate.candidate_id]
    );

    if (runResult.rows.length === 0) {
      return res.status(404).json({
        error: "Agent run not found",
      });
    }

    const run = runResult.rows[0];

    if (run.run_status === "cancelled") {
      return res.status(200).json({
        message: "Agent run is already cancelled",
      });
    }

    if (run.run_status === "completed" && run.application_status === "Applied") {
      return res.status(400).json({
        error: "Completed applied run cannot be cancelled",
      });
    }

    if (!ACTIVE_AGENT_RUN_STATUSES.includes(run.run_status)) {
      return res.status(400).json({
        error: "Only queued, running, or manual-action runs can be cancelled",
      });
    }

    await addAgentRunStep({
      agent_run_id: agentRunId,
      step_name: "candidate_cancelled_run",
      step_status: "cancelled",
      step_order: 99,
      details: "Candidate cancelled this AI agent run from the dashboard.",
    });

    let cancelledApplication = null;

    if (run.external_application_id && run.application_status === "Pending") {
      const applicationResult = await pool.query(
        `UPDATE external_applications
         SET application_status = 'Cancelled',
             failure_reason = 'Candidate cancelled this external apply run before manual completion.',
             updated_at = CURRENT_TIMESTAMP
         WHERE external_application_id = $1
         AND candidate_id = $2
         AND application_status = 'Pending'
         RETURNING *`,
        [run.external_application_id, candidate.candidate_id]
      );

      cancelledApplication = applicationResult.rows[0] || null;

      await addAgentRunStep({
        agent_run_id: agentRunId,
        step_name: "external_application_cancelled",
        step_status: "cancelled",
        step_order: 100,
        details: "Pending external application was marked as Cancelled.",
        metadata: {
          external_application_id: run.external_application_id,
        },
      });
    }

    await logAgentAttempt({
      candidate_id: candidate.candidate_id,
      external_job_id: run.external_job_id,
      external_application_id: run.external_application_id,
      action_type: "agent_run_cancelled",
      attempt_status: "cancelled",
      source_platform: run.source_platform,
      failure_reason: "Candidate cancelled the AI agent run",
      metadata: {
        agent_run_id: agentRunId,
        previous_run_status: run.run_status,
        previous_application_status: run.application_status,
      },
    });

    await finishAgentRun({
      agent_run_id: agentRunId,
      run_status: "cancelled",
      current_step: "cancelled",
      summary: "Candidate cancelled this AI agent run.",
      external_application_id: run.external_application_id,
      metadata: {
        cancelled_by_candidate: true,
        previous_run_status: run.run_status,
        application_cancelled: Boolean(cancelledApplication),
      },
    });

    return res.status(200).json({
      message: cancelledApplication
        ? "Agent run cancelled and pending external application marked Cancelled"
        : "Agent run cancelled",
      externalApplication: cancelledApplication,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Unable to cancel agent run",
    });
  }
};

const completeExternalApplication = async (req, res) => {
  let agentRunId = null;

  try {
    const { external_application_id } = req.body;

    if (!external_application_id) {
      return res.status(400).json({
        error: "external_application_id is required",
      });
    }

    const candidate = await getCandidateForUser(req.user.user_id);

    if (!candidate) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    const existingResult = await pool.query(
      `SELECT
        ea.external_application_id,
        ea.external_job_id,
        ea.application_status,
        ej.job_title,
        ej.company_name,
        ej.source_platform,
        ej.apply_mode
       FROM external_applications ea
       JOIN external_jobs ej
       ON ej.external_job_id = ea.external_job_id
       WHERE ea.external_application_id = $1
       AND ea.candidate_id = $2`,
      [external_application_id, candidate.candidate_id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        error: "External application not found",
      });
    }

    const existingApplication = existingResult.rows[0];

    agentRunId = await createAgentRun({
      candidate_id: candidate.candidate_id,
      external_job_id: existingApplication.external_job_id,
      external_application_id: existingApplication.external_application_id,
      requested_by_user_id: req.user.user_id,
      run_type: "manual_completion_confirmation",
      source_platform: existingApplication.source_platform,
      current_step: "candidate_confirmation_received",
      metadata: {
        job_title: existingApplication.job_title,
        company_name: existingApplication.company_name,
        previous_status: existingApplication.application_status,
      },
    });

    await addAgentRunStep({
      agent_run_id: agentRunId,
      step_name: "candidate_confirmation_received",
      step_order: 1,
      details: "Candidate confirmed that manual external application was completed.",
    });

    if (existingApplication.application_status !== "Pending") {
      await addAgentRunStep({
        agent_run_id: agentRunId,
        step_name: "completion_skipped",
        step_status: "skipped",
        step_order: 2,
        details: "External application was not pending, so no status change was needed.",
        metadata: {
          existing_status: existingApplication.application_status,
        },
      });

      await finishAgentRun({
        agent_run_id: agentRunId,
        run_status: "skipped",
        current_step: "completion_skipped",
        summary: "Manual completion skipped because application was already finalized.",
        external_application_id: existingApplication.external_application_id,
        metadata: {
          existing_status: existingApplication.application_status,
        },
      });

      return res.status(409).json({
        error: "External application is not pending",
      });
    }

    const result = await pool.query(
      `UPDATE external_applications
       SET application_status = 'Applied',
           failure_reason = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE external_application_id = $1
       AND candidate_id = $2
       AND application_status = 'Pending'
       RETURNING *`,
      [external_application_id, candidate.candidate_id]
    );

    await syncResolvedManualAgentRuns(
      candidate.candidate_id,
      result.rows[0].external_application_id
    );

    await addAgentRunStep({
      agent_run_id: agentRunId,
      step_name: "external_status_updated",
      step_order: 2,
      details: "Pending external application marked as Applied after candidate confirmation.",
      metadata: {
        previous_status: "Pending",
        new_status: "Applied",
      },
    });

    await logAgentAttempt({
      candidate_id: candidate.candidate_id,
      external_job_id: result.rows[0].external_job_id,
      external_application_id: result.rows[0].external_application_id,
      action_type: "manual_completion_confirmation",
      attempt_status: "manual_completed",
      source_platform: existingApplication.source_platform,
      failure_reason: null,
      metadata: {
        candidate_confirmed_manual_completion: true,
        job_title: existingApplication.job_title,
        company_name: existingApplication.company_name,
        apply_mode: existingApplication.apply_mode,
        agent_run_id: agentRunId,
      },
    });

    await finishAgentRun({
      agent_run_id: agentRunId,
      run_status: "completed",
      current_step: "completed",
      summary: "Candidate confirmed manual external application completion.",
      external_application_id: result.rows[0].external_application_id,
      metadata: {
        candidate_confirmed_manual_completion: true,
        previous_status: "Pending",
        new_status: "Applied",
      },
    });

    return res.status(200).json({
      message: "Marked as completed after manual submission",
      externalApplication: result.rows[0],
      agent_run_id: agentRunId,
    });
  } catch (error) {
    console.log(error);

    await finishAgentRun({
      agent_run_id: agentRunId,
      run_status: "failed",
      current_step: "failed",
      summary: "Manual completion orchestration failed.",
      error_message: error.message,
    });

    return res.status(500).json({
      error: "Unable to complete external application",
    });
  }
};


const runSafeBrowserSmokeTest = async (req, res) => {
  let agentRunId = null;

  try {
    const candidate = await getCandidateForUser(req.user.user_id);

    if (!candidate) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    agentRunId = await createAgentRun({
      candidate_id: candidate.candidate_id,
      external_job_id: null,
      requested_by_user_id: req.user.user_id,
      run_type: "safe_browser_smoke_test",
      run_status: "running",
      agent_name: "playwright_safe_browser_worker",
      source_platform: "Safe Local Dummy Portal",
      current_step: "browser_test_requested",
      metadata: {
        automation_mode: "safe_dummy_local_browser",
        real_external_submission: false,
        purpose: "Playwright foundation verification",
        job_title: "Safe Browser Automation Test",
        company_name: "HirePilot Safe Dummy Portal",
      },
    });

    await addAgentRunStep({
      agent_run_id: agentRunId,
      step_name: "browser_test_requested",
      step_status: "running",
      step_order: 0,
      details:
        "Candidate requested a safe Playwright browser automation smoke test.",
      metadata: {
        worker_url: workerBaseUrl(),
        real_external_submission: false,
      },
    });

    if (!isWorkerEnabled()) {
      await finishAgentRun({
        agent_run_id: agentRunId,
        run_status: "failed",
        current_step: "browser_automation_failed",
        summary: "Playwright smoke test could not start because Python worker is disabled.",
        error_message: "Python worker is disabled",
        metadata: { worker_enabled: false },
      });

      return res.status(400).json({
        error: "Python worker is disabled. Enable AI_WORKER_ENABLED=true first.",
        agent_run_id: agentRunId,
      });
    }

    await addAgentRunStep({
      agent_run_id: agentRunId,
      step_name: "browser_automation_started",
      step_status: "completed",
      step_order: 1,
      details: "Backend asked Python worker to start safe Playwright browser automation.",
      metadata: {
        worker_url: workerBaseUrl(),
        automation_mode: "safe_dummy_local_browser",
      },
    });

    const response = await axios.post(
      `${workerBaseUrl()}/browser/smoke-test`,
      {
        agent_run_id: agentRunId,
        candidate_id: candidate.candidate_id,
        requested_by_user_id: req.user.user_id,
      },
      {
        timeout: Number(process.env.AI_BROWSER_TEST_TIMEOUT_MS || 30000),
      }
    );

    const result = response.data?.result || {};

    await addAgentRunStep({
      agent_run_id: agentRunId,
      step_name: "dummy_portal_opened",
      step_status: "completed",
      step_order: 2,
      details: "Playwright opened a safe local dummy job application page.",
      metadata: {
        portal: result.portal || "safe_dummy_local_page",
        real_external_submission: false,
      },
    });

    await addAgentRunStep({
      agent_run_id: agentRunId,
      step_name: "application_form_filled",
      step_status: "completed",
      step_order: 3,
      details: "Playwright filled a dummy external application form with safe test data.",
      metadata: {
        contains_real_submission: false,
      },
    });

    await addAgentRunStep({
      agent_run_id: agentRunId,
      step_name: "resume_upload_simulated",
      step_status: "completed",
      step_order: 4,
      details: "Resume upload was simulated with a filename only. No real external portal upload occurred.",
      metadata: {
        resume_filename: "candidate-resume.pdf",
      },
    });

    await addAgentRunStep({
      agent_run_id: agentRunId,
      step_name: "dummy_portal_submitted",
      step_status: "completed",
      step_order: 5,
      details: "Playwright clicked submit on the safe dummy portal only.",
      metadata: {
        result_text: result.result_text || null,
      },
    });

    await finishAgentRun({
      agent_run_id: agentRunId,
      run_status: "completed",
      current_step: "browser_automation_completed",
      summary: "Playwright safe browser automation smoke test completed successfully.",
      metadata: {
        worker_url: workerBaseUrl(),
        automation_mode: "safe_dummy_local_browser",
        result,
      },
    });

    return res.status(200).json({
      message: "Safe Playwright browser automation test completed",
      agent_run_id: agentRunId,
      result: response.data,
    });
  } catch (error) {
    const workerError =
      error.response?.data?.detail ||
      error.response?.data?.error ||
      error.response?.data ||
      error.message ||
      "Safe Playwright browser automation test failed";

    console.log("SAFE BROWSER SMOKE TEST ERROR:", workerError);

    await addAgentRunStep({
      agent_run_id: agentRunId,
      step_name: "browser_test_request_failed",
      step_status: "failed",
      step_order: 100,
      details: "Backend could not complete the safe browser smoke test request.",
      metadata: {
        error: workerError,
      },
    });

    await finishAgentRun({
      agent_run_id: agentRunId,
      run_status: "failed",
      current_step: "browser_automation_failed",
      summary: "Safe Playwright browser automation test failed.",
      error_message:
        typeof workerError === "string"
          ? workerError
          : JSON.stringify(workerError),
      metadata: {
        worker_url: workerBaseUrl(),
        error: workerError,
      },
    });

    return res.status(500).json({
      error:
        typeof workerError === "string"
          ? workerError
          : "Safe Playwright browser automation test failed",
      agent_run_id: agentRunId,
    });
  }
};

const resetSafeDummyExternalApplication = async (req, res) => {
  if (!isDevelopmentEndpointEnabled()) {
    return res.status(404).json({
      error: "Development reset endpoint is not available",
    });
  }

  try {
    const candidate = await getCandidateForUser(req.user.user_id);

    if (!candidate) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    const result = await pool.query(
      `DELETE FROM external_applications ea
       USING external_jobs ej
       WHERE ea.external_job_id = ej.external_job_id
       AND ea.candidate_id = $1
       AND ej.job_title = $2
       AND ej.apply_mode = $3
       AND (
         ej.source_platform = $4
         OR ej.source_platform IS NULL
         OR BTRIM(ej.source_platform) = ''
       )
       RETURNING
         ea.external_application_id,
         ea.external_job_id,
         ea.application_status`,
      [
        candidate.candidate_id,
        "Safe Dummy Frontend Engineer",
        "safe_browser_apply",
        "HirePilot Safe Dummy Portal",
      ]
    );

    const resetApplication = result.rows[0] || null;

    return res.status(200).json({
      message: resetApplication
        ? "Safe dummy external application reset. You can apply again."
        : "Safe dummy external application is already available to apply.",
      reset: Boolean(resetApplication),
      external_job_id: resetApplication?.external_job_id || null,
    });
  } catch (error) {
    console.log("SAFE DUMMY EXTERNAL APPLY RESET ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to reset safe dummy external application",
    });
  }
};

const runCrawl4AiDemoDiscovery = async (req, res) => {
  if (!isDevelopmentEndpointEnabled()) {
    return res.status(404).json({
      error: "Development discovery endpoint is not available",
    });
  }

  let client = null;

  try {
    const sourceResult = await pool.query(
      `SELECT is_enabled, trust_status
       FROM external_sources
       WHERE source_key = $1
       LIMIT 1`,
      ["crawl4ai_demo"]
    );
    const discoverySource = sourceResult.rows[0];

    if (
      !discoverySource ||
      discoverySource.is_enabled !== true ||
      discoverySource.trust_status !== "approved"
    ) {
      return res.status(403).json({
        error: "Crawl4AI demo discovery source is disabled or not approved.",
      });
    }

    if (!isWorkerEnabled()) {
      return res.status(400).json({
        error: "Python worker is disabled. Enable it before running demo discovery.",
      });
    }

    const workerResponse = await axios.post(
      `${workerBaseUrl()}/discovery/crawl4ai-demo`,
      {},
      {
        timeout: Math.max(
          Number(process.env.AI_WORKER_TIMEOUT_MS || 30000),
          45000
        ),
      }
    );
    const discoveredJobs = Array.isArray(workerResponse.data?.jobs)
      ? workerResponse.data.jobs
      : [];
    const safeJobs = discoveredJobs.filter(
      (job) =>
        job &&
        job.source_platform === "Crawl4AI Demo Discovery" &&
        job.apply_mode === "manual_questions" &&
        job.discovery_source === "safe_raw_html" &&
        String(job.job_url || "").startsWith("crawl4ai-demo://") &&
        String(job.job_title || "").trim() &&
        String(job.company_name || "").trim()
    );

    if (safeJobs.length !== 3 || safeJobs.length !== discoveredJobs.length) {
      return res.status(502).json({
        error: "Worker returned an invalid safe demo discovery payload",
      });
    }

    client = await pool.connect();
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('hirepilot_crawl4ai_demo_discovery'))"
    );
    const reviewColumnsResult = await client.query(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
        AND table_name = 'external_jobs'
        AND column_name = 'review_status'
      ) AS has_review_status`
    );
    const hasReviewStatus = Boolean(
      reviewColumnsResult.rows[0]?.has_review_status
    );

    let insertedCount = 0;
    let updatedCount = 0;
    const jobs = [];

    for (const job of safeJobs) {
      const existingResult = await client.query(
        `SELECT external_job_id
         FROM external_jobs
         WHERE (
           source_platform = $1
           AND job_title = $2
           AND company_name = $3
         )
         OR job_url = $4
         ORDER BY external_job_id
         LIMIT 1`,
        [
          job.source_platform,
          job.job_title,
          job.company_name,
          job.job_url,
        ]
      );

      let savedJob;
      if (existingResult.rows.length > 0) {
        const updateResult = await client.query(
          `UPDATE external_jobs
           SET job_title = $2,
               company_name = $3,
               source_platform = $4,
               job_url = $5,
               required_skills = $6,
               experience_required = $7,
               location = $8,
               apply_mode = $9,
               is_active = TRUE,
               updated_at = CURRENT_TIMESTAMP
           WHERE external_job_id = $1
           RETURNING *`,
          [
            existingResult.rows[0].external_job_id,
            job.job_title,
            job.company_name,
            job.source_platform,
            job.job_url,
            job.required_skills,
            Number(job.experience_required) || 0,
            job.location,
            job.apply_mode,
          ]
        );
        savedJob = updateResult.rows[0];
        updatedCount += 1;
      } else {
        const insertColumns = hasReviewStatus
          ? `job_title,
             company_name,
             source_platform,
             job_url,
             required_skills,
             experience_required,
             location,
             apply_mode,
             is_active,
             review_status`
          : `job_title,
             company_name,
             source_platform,
             job_url,
             required_skills,
             experience_required,
             location,
             apply_mode,
             is_active`;
        const insertValues = hasReviewStatus
          ? "$1, $2, $3, $4, $5, $6, $7, $8, TRUE, 'pending_review'"
          : "$1, $2, $3, $4, $5, $6, $7, $8, TRUE";
        const insertResult = await client.query(
          `INSERT INTO external_jobs (${insertColumns})
           VALUES (${insertValues})
           RETURNING *`,
          [
            job.job_title,
            job.company_name,
            job.source_platform,
            job.job_url,
            job.required_skills,
            Number(job.experience_required) || 0,
            job.location,
            job.apply_mode,
          ]
        );
        savedJob = insertResult.rows[0];
        insertedCount += 1;
      }

      jobs.push({
        ...savedJob,
        job_description: job.job_description,
        discovery_source: job.discovery_source,
      });
    }

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Crawl4AI safe raw HTML demo discovery completed",
      discovered_count: safeJobs.length,
      inserted_count: insertedCount,
      updated_count: updatedCount,
      jobs,
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
    }

    const workerError =
      error.response?.data?.detail ||
      error.response?.data?.error ||
      error.message ||
      "Crawl4AI demo discovery failed";

    console.log("CRAWL4AI DEMO DISCOVERY ERROR:", workerError);

    return res.status(error.response?.status === 503 ? 503 : 500).json({
      error:
        typeof workerError === "string"
          ? workerError
          : "Crawl4AI demo discovery failed",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

const safeDiscoveryUrl = (value) => {
  try {
    const parsed = new URL(String(value || "").trim());
    const hostname = parsed.hostname.toLowerCase();

    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      !hostname ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local")
    ) {
      return null;
    }

    return parsed.toString();
  } catch (error) {
    return null;
  }
};

const discoveryJobUrl = (jobUrl, sourceUrl, jobTitle, index) => {
  const discoveredUrl = safeDiscoveryUrl(jobUrl);
  if (discoveredUrl) {
    return discoveredUrl;
  }

  const fallback = new URL(sourceUrl);
  const slug = String(jobTitle || "job")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  fallback.hash = `hirepilot-discovered-${slug || "job"}-${index + 1}`;
  return fallback.toString();
};

const cleanDiscoveryValue = (value, maxLength) =>
  String(value === null || value === undefined ? "" : value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const updateDiscoveryRun = async ({
  discoveryRunId,
  sourceId,
  runStatus,
  message,
  discoveredCount = 0,
  insertedCount = 0,
  updatedCount = 0,
  summary = null,
}) => {
  await pool.query(
    `WITH run_values AS (
       SELECT
         $1::integer AS discovery_run_id,
         $2::varchar(30) AS run_status,
         $3::integer AS discovered_count,
         $4::integer AS inserted_count,
         $5::integer AS updated_count,
         $6::text AS error_message,
         $7::jsonb AS raw_summary
     )
     UPDATE external_discovery_runs AS discovery_run
     SET run_status = run_values.run_status,
         discovered_count = run_values.discovered_count,
         inserted_count = run_values.inserted_count,
         updated_count = run_values.updated_count,
         error_message = run_values.error_message,
         raw_summary = run_values.raw_summary,
         started_at = CASE
           WHEN run_values.run_status = 'running'
             THEN COALESCE(discovery_run.started_at, CURRENT_TIMESTAMP)
           ELSE discovery_run.started_at
         END,
         completed_at = CASE
           WHEN run_values.run_status IN ('completed', 'failed', 'blocked')
             THEN CURRENT_TIMESTAMP
           ELSE discovery_run.completed_at
         END
     FROM run_values
     WHERE discovery_run.discovery_run_id = run_values.discovery_run_id`,
    [
      discoveryRunId,
      runStatus,
      discoveredCount,
      insertedCount,
      updatedCount,
      ["failed", "blocked"].includes(runStatus) ? message : null,
      summary ? JSON.stringify(summary) : null,
    ]
  );

  await pool.query(
    `UPDATE external_sources
     SET last_discovery_run_at = CURRENT_TIMESTAMP,
         last_discovery_status = $2::varchar(30),
         last_discovery_message = $3::text,
         updated_at = CURRENT_TIMESTAMP
     WHERE external_source_id = $1::integer`,
    [sourceId, runStatus, cleanDiscoveryValue(message, 2000) || null]
  );
};

const runAllowlistedSourceDiscovery = async (req, res) => {
  const sourceId = Number(req.params.sourceId);
  let discoveryRunId = null;
  let source = null;

  if (!sourceId) {
    return res.status(400).json({
      success: false,
      error: "Valid external source id is required",
    });
  }

  try {
    const sourceResult = await pool.query(
      `SELECT
        external_source_id,
        source_name,
        source_key,
        source_type,
        base_url,
        is_enabled,
        trust_status,
        safety_mode,
        real_crawl_allowed
       FROM external_sources
       WHERE external_source_id = $1
       LIMIT 1`,
      [sourceId]
    );
    source = sourceResult.rows[0];

    if (!source) {
      return res.status(404).json({
        success: false,
        error: "External discovery source not found",
      });
    }

    const isDemoSource = source.source_key === "crawl4ai_demo";
    const sourceUrl = isDemoSource
      ? String(source.base_url || "")
      : safeDiscoveryUrl(source.base_url);

    if (!sourceUrl) {
      return res.status(400).json({
        success: false,
        error: "A valid public HTTP or HTTPS base URL is required for discovery.",
      });
    }

    const runResult = await pool.query(
      `INSERT INTO external_discovery_runs (
        external_source_id,
        requested_by,
        source_url,
        run_status
       )
       VALUES (
         $1::integer,
         $2::integer,
         $3::text,
         $4::varchar(30)
       )
       RETURNING discovery_run_id`,
      [source.external_source_id, req.user.user_id, sourceUrl, "queued"]
    );
    discoveryRunId = runResult.rows[0].discovery_run_id;

    const blocked =
      source.is_enabled !== true ||
      source.trust_status !== "approved" ||
      (!isDemoSource && source.real_crawl_allowed !== true);

    if (blocked) {
      const message =
        "Discovery is blocked. The source must be approved, enabled, and explicitly allowed for real read-only crawling.";
      await updateDiscoveryRun({
        discoveryRunId,
        sourceId,
        runStatus: "blocked",
        message,
      });
      return res.status(403).json({
        success: false,
        message,
        discovery_run_id: discoveryRunId,
      });
    }

    if (isDemoSource) {
      const message =
        "Use the existing Crawl4AI Demo Discovery operation for the safe raw HTML source.";
      await updateDiscoveryRun({
        discoveryRunId,
        sourceId,
        runStatus: "blocked",
        message,
      });
      return res.status(400).json({
        success: false,
        message,
        discovery_run_id: discoveryRunId,
      });
    }

    if (!isWorkerEnabled()) {
      const message = "AI worker is disabled. Enable it before running discovery.";
      await updateDiscoveryRun({
        discoveryRunId,
        sourceId,
        runStatus: "failed",
        message,
      });
      return res.status(503).json({
        success: false,
        message,
        discovery_run_id: discoveryRunId,
      });
    }

    await updateDiscoveryRun({
      discoveryRunId,
      sourceId,
      runStatus: "running",
      message: "Read-only discovery is running.",
    });

    const workerResponse = await axios.post(
      `${workerBaseUrl()}/discovery/allowlisted-crawl`,
      {
        source_url: sourceUrl,
        source_name: source.source_name,
        source_key: source.source_key,
      },
      {
        timeout: Math.max(
          Number(process.env.AI_CRAWL4AI_DISCOVERY_TIMEOUT_MS || 90000),
          30000
        ),
      }
    );

    if (workerResponse.data?.success !== true) {
      throw new Error(
        workerResponse.data?.message || "AI worker returned an unsuccessful discovery result."
      );
    }

    const workerJobs = Array.isArray(workerResponse.data.jobs)
      ? workerResponse.data.jobs
      : [];
    const safeJobs = workerJobs
      .slice(0, 100)
      .map((job, index) => {
        const jobTitle = cleanDiscoveryValue(job?.job_title, 150);
        if (!jobTitle) {
          return null;
        }

        return {
          job_title: jobTitle,
          company_name:
            cleanDiscoveryValue(job?.company_name, 150) || source.source_name,
          location: cleanDiscoveryValue(job?.location, 100) || null,
          required_skills:
            cleanDiscoveryValue(job?.required_skills, 4000) || null,
          experience_required: Math.max(
            Number.parseInt(job?.experience_required, 10) || 0,
            0
          ),
          job_description:
            cleanDiscoveryValue(job?.job_description, 6000) || null,
          job_url: discoveryJobUrl(
            job?.job_url,
            sourceUrl,
            jobTitle,
            index
          ),
        };
      })
      .filter(Boolean);

    const client = await pool.connect();
    let insertedCount = 0;
    let updatedCount = 0;
    const jobs = [];

    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [`hirepilot_allowlisted_discovery_${source.external_source_id}`]
      );

      for (const job of safeJobs) {
        const existingResult = await client.query(
          `SELECT external_job_id
           FROM external_jobs
           WHERE job_url = $1
              OR (
                source_platform = $2
                AND LOWER(job_title) = LOWER($3)
                AND LOWER(company_name) = LOWER($4)
              )
           ORDER BY
             CASE WHEN job_url = $1 THEN 0 ELSE 1 END,
             external_job_id
           LIMIT 1`,
          [job.job_url, source.source_name, job.job_title, job.company_name]
        );

        let savedJob;
        if (existingResult.rows.length) {
          const updated = await client.query(
            `UPDATE external_jobs
             SET job_title = $2,
                 company_name = $3,
                 source_platform = $4,
                 job_url = $5,
                 required_skills = $6,
                 experience_required = $7,
                 location = $8,
                 apply_mode = 'manual_questions',
                 discovery_source = 'allowlisted_crawl4ai',
                 is_active = TRUE,
                 discovered_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE external_job_id = $1
             RETURNING *`,
            [
              existingResult.rows[0].external_job_id,
              job.job_title,
              job.company_name,
              source.source_name,
              job.job_url,
              job.required_skills,
              job.experience_required,
              job.location,
            ]
          );
          savedJob = updated.rows[0];
          updatedCount += 1;
        } else {
          const inserted = await client.query(
            `INSERT INTO external_jobs (
              job_title,
              company_name,
              source_platform,
              job_url,
              required_skills,
              experience_required,
              location,
              apply_mode,
              is_active,
              review_status,
              discovery_source,
              discovered_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual_questions', TRUE,
               'pending_review', 'allowlisted_crawl4ai', CURRENT_TIMESTAMP)
             RETURNING *`,
            [
              job.job_title,
              job.company_name,
              source.source_name,
              job.job_url,
              job.required_skills,
              job.experience_required,
              job.location,
            ]
          );
          savedJob = inserted.rows[0];
          insertedCount += 1;
        }

        jobs.push({ ...savedJob, job_description: job.job_description });
      }

      await client.query("COMMIT");
    } catch (databaseError) {
      await client.query("ROLLBACK");
      throw databaseError;
    } finally {
      client.release();
    }

    const message = `Read-only discovery completed. Discovered: ${safeJobs.length}; inserted: ${insertedCount}; updated: ${updatedCount}. No applications were submitted.`;
    await updateDiscoveryRun({
      discoveryRunId,
      sourceId,
      runStatus: "completed",
      message,
      discoveredCount: safeJobs.length,
      insertedCount,
      updatedCount,
      summary: {
        mode: "read_only_allowlisted_discovery",
        source_key: source.source_key,
        worker_message: cleanDiscoveryValue(workerResponse.data.message, 1000),
        jobs: safeJobs.map((job) => ({
          job_title: job.job_title,
          company_name: job.company_name,
          job_url: job.job_url,
        })),
      },
    });

    return res.status(200).json({
      success: true,
      message,
      discovery_run_id: discoveryRunId,
      discovered_count: safeJobs.length,
      inserted_count: insertedCount,
      updated_count: updatedCount,
      jobs,
    });
  } catch (error) {
    const workerMessage =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Read-only discovery failed";
    const message = cleanDiscoveryValue(workerMessage, 2000);

    if (discoveryRunId && source) {
      try {
        await updateDiscoveryRun({
          discoveryRunId,
          sourceId: source.external_source_id,
          runStatus: "failed",
          message,
        });
      } catch (statusError) {
        console.log("DISCOVERY RUN STATUS UPDATE ERROR:", statusError.message);
      }
    }

    console.log("ALLOWLISTED DISCOVERY ERROR:", message);
    const workerUnavailable =
      error.code === "ECONNREFUSED" ||
      error.code === "ETIMEDOUT" ||
      error.response?.status === 503;
    return res.status(workerUnavailable ? 503 : 500).json({
      success: false,
      message: workerUnavailable
        ? `AI worker is unavailable: ${message}`
        : message || "Unable to run read-only discovery",
      discovery_run_id: discoveryRunId,
    });
  }
};

module.exports = {
  getMatchedExternalJobs,
  getMyExternalApplications,
  getExternalAgentLogs,
  getExternalAgentRuns,
  getExternalWorkerHealth,
  applyExternalJob,
  retryExternalAgentRun,
  cancelExternalAgentRun,
  completeExternalApplication,
  runSafeBrowserSmokeTest,
  resetSafeDummyExternalApplication,
  runCrawl4AiDemoDiscovery,
  runAllowlistedSourceDiscovery,
};
