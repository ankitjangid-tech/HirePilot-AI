const pool = require("../config/db");

const RECRUITER_STATUSES = ["pending", "approved", "blocked"];

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

module.exports = {
  getRecruiters,
  updateRecruiterStatus,
};
