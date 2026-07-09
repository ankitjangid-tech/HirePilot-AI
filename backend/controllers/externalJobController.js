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

const applyExternalJob = async (req, res) => {
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
        },
      });

      return res.status(409).json({
        error: "External application already exists",
        external_application_id: existing.rows[0].external_application_id,
        application_status: existing.rows[0].application_status,
      });
    }

    const canAutoComplete = job.apply_mode === "easy_apply" && match.match_score >= 60;
    const applicationStatus = canAutoComplete ? "Applied" : "Pending";
    const failureReason = canAutoComplete
      ? null
      : "Manual action needed: external portal may require questions, login, CAPTCHA, or candidate review.";

    const application = await pool.query(
      `INSERT INTO external_applications (
        candidate_id,
        external_job_id,
        application_status,
        failure_reason
       )
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [candidate.candidate_id, external_job_id, applicationStatus, failureReason]
    );

    await logAgentAttempt({
      candidate_id: candidate.candidate_id,
      external_job_id,
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
      },
    });

    return res.status(200).json({
      message: canAutoComplete
        ? "External application submitted"
        : "External application needs manual completion",
      externalApplication: {
        ...application.rows[0],
        job_title: job.job_title,
        company_name: job.company_name,
        source_platform: job.source_platform,
        job_url: job.job_url,
        match_score: match.match_score,
      },
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "External application failed",
    });
  }
};

const completeExternalApplication = async (req, res) => {
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

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Pending external application not found",
      });
    }

    const jobResult = await pool.query(
      `SELECT
        external_job_id,
        job_title,
        company_name,
        source_platform,
        apply_mode
       FROM external_jobs
       WHERE external_job_id = $1`,
      [result.rows[0].external_job_id]
    );

    const job = jobResult.rows[0] || {};

    await logAgentAttempt({
      candidate_id: candidate.candidate_id,
      external_job_id: result.rows[0].external_job_id,
      external_application_id: result.rows[0].external_application_id,
      action_type: "manual_completion_confirmation",
      attempt_status: "manual_completed",
      source_platform: job.source_platform,
      failure_reason: null,
      metadata: {
        candidate_confirmed_manual_completion: true,
        job_title: job.job_title,
        company_name: job.company_name,
        apply_mode: job.apply_mode,
      },
    });

    return res.status(200).json({
      message: "Marked as completed after manual submission",
      externalApplication: result.rows[0],
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Unable to complete external application",
    });
  }
};

module.exports = {
  getMatchedExternalJobs,
  getMyExternalApplications,
  getExternalAgentLogs,
  applyExternalJob,
  completeExternalApplication,
};
