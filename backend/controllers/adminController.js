const pool = require("../config/db");
const {
  runCrawl4AiDemoDiscovery: runExternalCrawl4AiDemoDiscovery,
} = require("./externalJobController");

const RECRUITER_STATUSES = ["pending", "approved", "blocked"];
const EXTERNAL_JOB_REVIEW_STATUSES = [
  "pending_review",
  "approved",
  "hidden",
  "rejected",
];
const EXTERNAL_SOURCE_TYPES = [
  "demo_raw_html",
  "simulated_platform",
  "company_career_page",
  "job_board",
];
const EXTERNAL_SOURCE_TRUST_STATUSES = ["pending", "approved", "blocked"];

const optionalText = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value).trim() || null;
};

const getRecruiters = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        user_id,
        full_name,
        email,
        COALESCE(recruiter_status, 'pending') AS recruiter_status,
        recruiter_status_reason,
        recruiter_status_updated_at,
        created_at
       FROM users
       WHERE role = 'recruiter'
       ORDER BY
         CASE COALESCE(recruiter_status, 'pending')
           WHEN 'pending' THEN 1
           WHEN 'blocked' THEN 2
           ELSE 3
         END,
         created_at DESC,
         user_id DESC`
    );

    return res.status(200).json({
      recruiters: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.log("ADMIN RECRUITER LIST ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to fetch recruiters",
    });
  }
};

const updateRecruiterStatus = async (req, res) => {
  try {
    const recruiterUserId = Number(req.params.userId);
    const recruiterStatus = String(req.body.recruiter_status || "").toLowerCase();
    const statusReason = req.body.recruiter_status_reason
      ? String(req.body.recruiter_status_reason).trim()
      : null;

    if (!recruiterUserId) {
      return res.status(400).json({
        error: "Valid recruiter user id is required",
      });
    }

    if (!RECRUITER_STATUSES.includes(recruiterStatus)) {
      return res.status(400).json({
        error: "Recruiter status must be pending, approved, or blocked",
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET recruiter_status = $2,
           recruiter_status_reason = $3,
           recruiter_status_updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       AND role = 'recruiter'
       RETURNING
         user_id,
         full_name,
         email,
         recruiter_status,
         recruiter_status_reason,
         recruiter_status_updated_at,
         created_at`,
      [
        recruiterUserId,
        recruiterStatus,
        recruiterStatus === "approved" ? null : statusReason,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Recruiter account not found",
      });
    }

    return res.status(200).json({
      message: `Recruiter account ${recruiterStatus}.`,
      recruiter: result.rows[0],
    });
  } catch (error) {
    console.log("ADMIN RECRUITER STATUS UPDATE ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to update recruiter status",
    });
  }
};

const getExternalJobs = async (req, res) => {
  try {
    const result = await pool.query(
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
        ej.is_active,
        COALESCE(ej.review_status, 'approved') AS review_status,
        ej.review_notes,
        ej.reviewed_by,
        ej.reviewed_at,
        ej.discovered_at,
        ej.created_at,
        reviewer.full_name AS reviewed_by_name
       FROM external_jobs ej
       LEFT JOIN users reviewer
       ON reviewer.user_id = ej.reviewed_by
       ORDER BY
         CASE COALESCE(ej.review_status, 'approved')
           WHEN 'pending_review' THEN 1
           WHEN 'hidden' THEN 2
           WHEN 'rejected' THEN 3
           ELSE 4
         END,
         COALESCE(ej.discovered_at, ej.created_at) DESC,
         ej.external_job_id DESC`
    );

    return res.status(200).json({
      externalJobs: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.log("ADMIN EXTERNAL JOB LIST ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to fetch external jobs for review",
    });
  }
};

const reviewExternalJob = async (req, res) => {
  try {
    const externalJobId = Number(req.params.externalJobId);
    const reviewStatus = String(req.body.review_status || "").toLowerCase();
    const reviewNotes = req.body.review_notes
      ? String(req.body.review_notes).trim()
      : null;

    if (!externalJobId) {
      return res.status(400).json({
        error: "Valid external job id is required",
      });
    }

    if (!EXTERNAL_JOB_REVIEW_STATUSES.includes(reviewStatus)) {
      return res.status(400).json({
        error:
          "Review status must be pending_review, approved, hidden, or rejected",
      });
    }

    const result = await pool.query(
      `UPDATE external_jobs
       SET review_status = $2,
           review_notes = $3,
           reviewed_by = $4,
           reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE external_job_id = $1
       RETURNING *`,
      [externalJobId, reviewStatus, reviewNotes, req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "External job not found",
      });
    }

    return res.status(200).json({
      message: `External job marked ${reviewStatus.replace(/_/g, " ")}.`,
      externalJob: result.rows[0],
    });
  } catch (error) {
    console.log("ADMIN EXTERNAL JOB REVIEW ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to update external job review status",
    });
  }
};

const getExternalSources = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        external_source_id,
        source_name,
        source_key,
        source_type,
        base_url,
        is_enabled,
        trust_status,
        safety_mode,
        notes,
        created_by,
        created_at,
        updated_at
       FROM external_sources
       ORDER BY
         CASE source_key WHEN 'crawl4ai_demo' THEN 1 ELSE 2 END,
         created_at DESC,
         external_source_id DESC`
    );

    return res.status(200).json({
      externalSources: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.log("ADMIN EXTERNAL SOURCE LIST ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to fetch external discovery sources",
    });
  }
};

const createExternalSource = async (req, res) => {
  try {
    const sourceName = String(req.body.source_name || "").trim();
    const sourceKey = String(req.body.source_key || "").trim().toLowerCase();
    const sourceType = String(req.body.source_type || "").trim().toLowerCase();
    const trustStatus = String(
      req.body.trust_status || "pending"
    ).trim().toLowerCase();
    const safetyMode =
      String(req.body.safety_mode || "manual_review").trim() ||
      "manual_review";
    const isEnabled =
      typeof req.body.is_enabled === "boolean" ? req.body.is_enabled : false;

    if (!sourceName || !sourceKey || !sourceType) {
      return res.status(400).json({
        error: "Source name, source key, and source type are required",
      });
    }

    if (!/^[a-z0-9][a-z0-9_-]*$/.test(sourceKey)) {
      return res.status(400).json({
        error:
          "Source key must use lowercase letters, numbers, hyphens, or underscores",
      });
    }

    if (!EXTERNAL_SOURCE_TYPES.includes(sourceType)) {
      return res.status(400).json({
        error: `Source type must be one of: ${EXTERNAL_SOURCE_TYPES.join(", ")}`,
      });
    }

    if (!EXTERNAL_SOURCE_TRUST_STATUSES.includes(trustStatus)) {
      return res.status(400).json({
        error: "Trust status must be pending, approved, or blocked",
      });
    }

    const result = await pool.query(
      `INSERT INTO external_sources (
        source_name,
        source_key,
        source_type,
        base_url,
        is_enabled,
        trust_status,
        safety_mode,
        notes,
        created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        sourceName,
        sourceKey,
        sourceType,
        optionalText(req.body.base_url),
        isEnabled,
        trustStatus,
        safetyMode,
        optionalText(req.body.notes),
        req.user.user_id,
      ]
    );

    return res.status(201).json({
      message: "External discovery source created.",
      externalSource: result.rows[0],
    });
  } catch (error) {
    console.log("ADMIN EXTERNAL SOURCE CREATE ERROR:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "An external discovery source with this source key already exists",
      });
    }

    return res.status(500).json({
      error: "Unable to create external discovery source",
    });
  }
};

const updateExternalSource = async (req, res) => {
  try {
    const sourceId = Number(req.params.sourceId);
    const updates = [];
    const values = [sourceId];

    if (!sourceId) {
      return res.status(400).json({
        error: "Valid external source id is required",
      });
    }

    if (req.body.is_enabled !== undefined) {
      if (typeof req.body.is_enabled !== "boolean") {
        return res.status(400).json({
          error: "is_enabled must be true or false",
        });
      }

      values.push(req.body.is_enabled);
      updates.push(`is_enabled = $${values.length}`);
    }

    if (req.body.trust_status !== undefined) {
      const trustStatus = String(req.body.trust_status).trim().toLowerCase();

      if (!EXTERNAL_SOURCE_TRUST_STATUSES.includes(trustStatus)) {
        return res.status(400).json({
          error: "Trust status must be pending, approved, or blocked",
        });
      }

      values.push(trustStatus);
      updates.push(`trust_status = $${values.length}`);
    }

    if (req.body.notes !== undefined) {
      values.push(optionalText(req.body.notes));
      updates.push(`notes = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: "Provide is_enabled, trust_status, or notes to update",
      });
    }

    const result = await pool.query(
      `UPDATE external_sources
       SET ${updates.join(", ")},
           updated_at = CURRENT_TIMESTAMP
       WHERE external_source_id = $1
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "External discovery source not found",
      });
    }

    return res.status(200).json({
      message: "External discovery source updated.",
      externalSource: result.rows[0],
    });
  } catch (error) {
    console.log("ADMIN EXTERNAL SOURCE UPDATE ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to update external discovery source",
    });
  }
};

const runCrawl4AiDemoDiscovery = async (req, res) => {
  const sendJson = res.json.bind(res);

  res.json = (payload = {}) => {
    const success = res.statusCode >= 200 && res.statusCode < 300;

    if (!success) {
      return sendJson({
        ...payload,
        success: false,
        message:
          payload.message ||
          payload.error ||
          "Crawl4AI demo discovery failed",
      });
    }

    return sendJson({
      success: true,
      message:
        payload.message || "Crawl4AI demo discovery completed",
      discovered_count: Number(payload.discovered_count || 0),
      inserted_count: Number(payload.inserted_count || 0),
      updated_count: Number(payload.updated_count || 0),
      jobs: Array.isArray(payload.jobs) ? payload.jobs : [],
    });
  };

  try {
    return await runExternalCrawl4AiDemoDiscovery(req, res);
  } catch (error) {
    console.log("ADMIN CRAWL4AI DEMO DISCOVERY ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to run Crawl4AI demo discovery",
    });
  }
};

module.exports = {
  getRecruiters,
  updateRecruiterStatus,
  getExternalJobs,
  reviewExternalJob,
  getExternalSources,
  createExternalSource,
  updateExternalSource,
  runCrawl4AiDemoDiscovery,
};
