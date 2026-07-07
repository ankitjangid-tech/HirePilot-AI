const pool = require("../config/db");
const { sendEmail } = require("../services/emailService");
const { createNotification } = require("./notificationController");

const allowedStatuses = ["Shortlisted", "Rejected", "Selected"];

const getCandidateUser = async (candidateId) => {
  const userResult = await pool.query(
    `SELECT u.email, u.full_name
     FROM users u
     JOIN candidates c
     ON u.user_id=c.user_id
     WHERE c.candidate_id=$1`,
    [candidateId]
  );

  return userResult.rows[0];
};

const updateApplicationStatus = async (req, res) => {
  try {
    const { application_id, application_status } = req.body;

    if (!application_id || !application_status) {
      return res.status(400).json({
        error: "application_id and application_status are required",
      });
    }

    if (!allowedStatuses.includes(application_status)) {
      return res.status(400).json({
        error: "Invalid application status",
      });
    }

    const currentResult = await pool.query(
      `SELECT
        application_id,
        application_status,
        candidate_id,
        job_id
       FROM applications
       WHERE application_id=$1`,
      [application_id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        error: "Application not found",
      });
    }

    const currentApplication = currentResult.rows[0];
    const currentStatus = currentApplication.application_status;
    const candidateId = currentApplication.candidate_id;
    const jobId = currentApplication.job_id;

    if (currentStatus === application_status) {
      return res.status(200).json({
        message: "Status already updated",
        application: currentApplication,
      });
    }

    const result = await pool.query(
      `UPDATE applications
       SET application_status=$1
       WHERE application_id=$2
       RETURNING *`,
      [application_status, application_id]
    );

    const application = result.rows[0];

    if (application_status === "Shortlisted") {
      await createNotification({
        candidateId,
        message: "You have been shortlisted for the next hiring stage.",
        notificationType: "shortlisted",
        referenceType: "application",
        referenceId: Number(application_id),
      });

      const user = await getCandidateUser(candidateId);

      if (user) {
        await sendEmail(
          user.email,
          "HirePilot AI - Application Update",
          `
          <h2>Hello ${user.full_name}</h2>
          <p>Congratulations! You have been shortlisted for the next hiring stage.</p>
          `
        );
      }
    }

    if (application_status === "Rejected") {
      await pool.query(
        `UPDATE interviews
         SET status='Cancelled'
         WHERE candidate_id=$1
         AND job_id=$2
         AND COALESCE(status,'Scheduled')<>'Cancelled'`,
        [candidateId, jobId]
      );

      await createNotification({
        candidateId,
        message: "Unfortunately your application was not selected.",
        notificationType: "rejected",
        referenceType: "application",
        referenceId: Number(application_id),
      });
    }

    if (application_status === "Selected") {
      await createNotification({
        candidateId,
        message: "Congratulations! You have been selected.",
        notificationType: "selected",
        referenceType: "application",
        referenceId: Number(application_id),
      });
    }

    res.status(200).json({
      message: "Status updated",
      application,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Status update failed",
    });
  }
};

module.exports = {
  updateApplicationStatus,
};
