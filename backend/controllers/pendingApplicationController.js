const pool = require("../config/db");

const getPendingApplications = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const candidate = await pool.query(
      `SELECT candidate_id
       FROM candidates
       WHERE user_id=$1`,
      [user_id]
    );

    const candidate_id = candidate.rows[0]?.candidate_id;

    if (!candidate_id) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    const result = await pool.query(
      `SELECT
        a.application_id,
        a.job_id,
        a.application_status,
        a.applied_at,
        j.job_title,
        j.company_name
       FROM applications a
       JOIN jobs j
       ON a.job_id = j.job_id
       WHERE a.candidate_id = $1
       AND a.application_status = 'Pending'
       ORDER BY a.application_id DESC`,
      [candidate_id]
    );

    res.status(200).json({
      pendingApplications: result.rows,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Unable to fetch pending applications",
    });
  }
};

const completeApplication = async (req, res) => {
  try {
    const { application_id } = req.body;

    if (!application_id) {
      return res.status(400).json({
        error: "application_id is required",
      });
    }

    const user_id = req.user.user_id;

    const candidate = await pool.query(
      `SELECT candidate_id
       FROM candidates
       WHERE user_id=$1`,
      [user_id]
    );

    const candidate_id = candidate.rows[0]?.candidate_id;

    if (!candidate_id) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    const result = await pool.query(
      `UPDATE applications
       SET application_status = 'Applied',
           applied_at = NOW()
       WHERE application_id = $1
       AND candidate_id = $2
       AND application_status = 'Pending'
       RETURNING *`,
      [application_id, candidate_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Pending application not found",
      });
    }

    res.status(200).json({
      message: "Application completed",
      application: result.rows[0],
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Unable to complete application",
    });
  }
};

module.exports = {
  getPendingApplications,
  completeApplication,
};