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
  runCrawl4AiDemoDiscovery,
};
