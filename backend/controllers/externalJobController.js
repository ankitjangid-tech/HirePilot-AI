const axios = require("axios");
const pool = require("../config/db");

const splitSkills = (skills) => {
  if (!skills) {
    return [];
  }

  return skills
    .toLowerCase()
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
};

const normalizeSkillLabel = (skill) =>
  skill
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const calculateExternalMatch = (candidate, job) => {
  const candidateSkills = splitSkills(candidate.skills);
  const jobSkills = splitSkills(job.required_skills);

  const matchedSkills = [];
  const missingSkills = [];

  jobSkills.forEach((skill) => {
    if (candidateSkills.includes(skill)) {
      matchedSkills.push(normalizeSkillLabel(skill));
    } else {
      missingSkills.push(normalizeSkillLabel(skill));
    }
  });

  let score = matchedSkills.length * 20;

  if (
    candidate.preferred_role &&
    job.job_title &&
    job.job_title
      .toLowerCase()
      .includes(candidate.preferred_role.toLowerCase().split(" ")[0])
  ) {
    score += 10;
  }

  if (
    candidate.preferred_location &&
    job.location &&
    job.location.toLowerCase().includes(candidate.preferred_location.toLowerCase())
  ) {
    score += 10;
  }

  return {
    match_score: Math.min(score, 100),
    matched_skills: matchedSkills,
    missing_skills: missingSkills,
  };
};

const getCandidateForUser = async (userId) => {
  const candidateResult = await pool.query(
    `SELECT
      candidate_id,
      skills,
      experience_years,
      preferred_role,
      preferred_location,
      expected_salary
     FROM candidates
     WHERE user_id = $1`,
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
        started_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, CURRENT_TIMESTAMP)
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
      ]
    );
  } catch (error) {
    console.log("AGENT RUN FINISH ERROR:", error.message);
  }
};

const callPythonWorker = async ({ agentRunId, candidate, job, match, userId }) => {
  if (!isWorkerEnabled()) {
    return null;
  }

  try {
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
        preferred_role: candidate.preferred_role,
        preferred_location: candidate.preferred_location,
        experience_years: candidate.experience_years,
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

    return null;
  }
};

const processExternalApplyLocally = async ({ agentRunId, candidate, job, match }) => {
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

  const application = await pool.query(
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

    if (isProfileIncomplete(candidate)) {
      return res.status(400).json({
        error: "Please complete your profile before external job discovery",
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
        ea.external_application_id,
        ea.application_status,
        ea.failure_reason,
        ea.applied_at
       FROM external_jobs ej
       LEFT JOIN external_applications ea
       ON ea.external_job_id = ej.external_job_id
       AND ea.candidate_id = $1
       WHERE ej.is_active = TRUE
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
      .filter((job) => job.match_score >= 40)
      .sort((a, b) => b.match_score - a.match_score);

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
        aar.summary,
        aar.error_message,
        aar.metadata,
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
       LEFT JOIN ai_agent_run_steps ars
       ON ars.agent_run_id = aar.agent_run_id
       WHERE aar.candidate_id = $1
       GROUP BY aar.agent_run_id, ej.job_title, ej.company_name
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

const applyExternalJob = async (req, res) => {
  let agentRunId = null;

  try {
    const { external_job_id } = req.body;

    if (!external_job_id) {
      return res.status(400).json({
        error: "external_job_id is required",
      });
    }

    const candidate = await getCandidateForUser(req.user.user_id);

    if (!candidate) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    if (isProfileIncomplete(candidate)) {
      return res.status(400).json({
        error: "Please complete your profile before external apply",
      });
    }

    const jobResult = await pool.query(
      `SELECT *
       FROM external_jobs
       WHERE external_job_id = $1
       AND is_active = TRUE`,
      [external_job_id]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        error: "External job not found",
      });
    }

    const job = jobResult.rows[0];
    const match = calculateExternalMatch(candidate, job);

    agentRunId = await createAgentRun({
      candidate_id: candidate.candidate_id,
      external_job_id,
      requested_by_user_id: req.user.user_id,
      run_type: "external_apply",
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
      },
    });

    if (match.match_score < 40) {
      await logAgentAttempt({
        candidate_id: candidate.candidate_id,
        external_job_id,
        action_type: "external_apply_attempt",
        attempt_status: "skipped_low_match",
        source_platform: job.source_platform,
        failure_reason: "External job match score is too low for auto apply",
        metadata: {
          match_score: match.match_score,
          matched_skills: match.matched_skills,
          missing_skills: match.missing_skills,
          apply_mode: job.apply_mode,
          agent_run_id: agentRunId,
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
        },
      });

      return res.status(400).json({
        error: "External job match score is too low for auto apply",
      });
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
      await logAgentAttempt({
        candidate_id: candidate.candidate_id,
        external_job_id,
        external_application_id: existing.rows[0].external_application_id,
        action_type: "external_apply_attempt",
        attempt_status: "skipped_duplicate",
        source_platform: job.source_platform,
        failure_reason: "External application already exists",
        metadata: {
          existing_status: existing.rows[0].application_status,
          match_score: match.match_score,
          apply_mode: job.apply_mode,
          agent_run_id: agentRunId,
        },
      });

      await addAgentRunStep({
        agent_run_id: agentRunId,
        step_name: "duplicate_application_detected",
        step_status: "skipped",
        step_order: 1,
        details: "Agent found an existing external application and did not create a duplicate.",
        metadata: {
          existing_status: existing.rows[0].application_status,
          external_application_id: existing.rows[0].external_application_id,
        },
      });

      await finishAgentRun({
        agent_run_id: agentRunId,
        run_status: "skipped",
        current_step: "duplicate_application_detected",
        summary: "External apply skipped because application already exists.",
        external_application_id: existing.rows[0].external_application_id,
        metadata: {
          existing_status: existing.rows[0].application_status,
          match_score: match.match_score,
        },
      });

      return res.status(409).json({
        error: "External application already exists",
        external_application_id: existing.rows[0].external_application_id,
        application_status: existing.rows[0].application_status,
      });
    }

    const workerResult = await callPythonWorker({
      agentRunId,
      candidate,
      job,
      match,
      userId: req.user.user_id,
    });

    if (workerResult) {
      if (workerResult.outcome === "skipped_low_match") {
        return res.status(400).json({
          error: workerResult.message,
          agent_run_id: agentRunId,
        });
      }

      if (workerResult.outcome === "skipped_duplicate") {
        return res.status(409).json({
          error: workerResult.message,
          external_application_id: workerResult.external_application_id,
          application_status: workerResult.application_status,
          agent_run_id: agentRunId,
        });
      }

      return res.status(200).json({
        message: workerResult.message,
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
      });
    }

    const localResult = await processExternalApplyLocally({
      agentRunId,
      candidate,
      job,
      match,
    });

    return res.status(200).json({
      message: localResult.message,
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
    });
  } catch (error) {
    console.log(error);

    await finishAgentRun({
      agent_run_id: agentRunId,
      run_status: "failed",
      current_step: "failed",
      summary: "External apply orchestration failed.",
      error_message: error.message,
    });

    return res.status(500).json({
      error: "External application failed",
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

module.exports = {
  getMatchedExternalJobs,
  getMyExternalApplications,
  getExternalAgentLogs,
  getExternalAgentRuns,
  getExternalWorkerHealth,
  applyExternalJob,
  completeExternalApplication,
};
