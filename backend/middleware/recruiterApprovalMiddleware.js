const pool = require("../config/db");

const requireApprovedRecruiter = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT recruiter_status
       FROM users
       WHERE user_id = $1
       AND role = 'recruiter'`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        error: "Recruiter account not found.",
      });
    }

    const recruiterStatus = result.rows[0].recruiter_status || "pending";

    if (recruiterStatus === "pending") {
      return res.status(403).json({
        error: "Recruiter account is pending admin approval.",
        recruiter_status: recruiterStatus,
      });
    }

    if (recruiterStatus === "blocked") {
      return res.status(403).json({
        error: "Recruiter account is blocked. Contact admin.",
        recruiter_status: recruiterStatus,
      });
    }

    if (recruiterStatus !== "approved") {
      return res.status(403).json({
        error: "Recruiter account is pending admin approval.",
        recruiter_status: "pending",
      });
    }

    req.recruiterStatus = recruiterStatus;
    return next();
  } catch (error) {
    console.log("RECRUITER APPROVAL CHECK ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to verify recruiter approval status",
    });
  }
};

module.exports = { requireApprovedRecruiter };
