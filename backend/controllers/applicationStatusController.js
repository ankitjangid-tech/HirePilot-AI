const pool = require("../config/db");
const {
  buildEmailHtml,
  getEmailDeliveryMessage,
  sendEmail,
} = require("../services/emailService");
const { createNotification } = require("./notificationController");

const allowedStatuses = ["Shortlisted", "Rejected", "Selected"];

const getApplicationEmailContext = async (candidateId, jobId) => {
  const userResult = await pool.query(
    `SELECT
      u.email,
      u.full_name,
      j.job_title,
      j.company_name
     FROM users u
     JOIN candidates c
     ON u.user_id=c.user_id
     JOIN jobs j
     ON j.job_id=$2
     WHERE c.candidate_id=$1`,
    [candidateId, jobId]
  );

  return userResult.rows[0] || null;
};

const sendApplicationStatusEmail = async ({ context, applicationStatus }) => {
  if (!context) {
    return sendEmail(null, "HirePilot AI - Application Update", "");
  }

  const isShortlisted = applicationStatus === "Shortlisted";
  const subject = isShortlisted
    ? `You're shortlisted for ${context.job_title}`
    : `Application update for ${context.job_title}`;
  const title = isShortlisted
    ? "You have been shortlisted"
    : "Your application was not selected";
  const paragraphs = isShortlisted
    ? [
        `${context.company_name} shortlisted your application for ${context.job_title}.`,
        "The recruiter may contact you or schedule an interview through HirePilot AI.",
      ]
    : [
        `${context.company_name} has completed its review for ${context.job_title}, and your application was not selected.`,
        "Thank you for applying. You can continue reviewing other matched opportunities in HirePilot AI.",
      ];

  return sendEmail(
    context.email,
    subject,
    buildEmailHtml({
      recipientName: context.full_name,
      title,
      paragraphs,
      details: [
        { label: "Role", value: context.job_title },
        { label: "Company", value: context.company_name },
        { label: "Status", value: applicationStatus },
      ],
    })
  );
};

const deliverApplicationStatusEmail = async ({
  candidateId,
  jobId,
  applicationStatus,
}) => {
  try {
    const context = await getApplicationEmailContext(candidateId, jobId);

    return await sendApplicationStatusEmail({ context, applicationStatus });
  } catch (error) {
    console.warn(
      "[EMAIL] Application notification preparation failed. The status update remains complete."
    );
    return {
      sent: false,
      configured: null,
      status: "failed",
    };
  }
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
        a.application_id,
        a.application_status,
        a.candidate_id,
        a.job_id
       FROM applications a
       JOIN jobs j
       ON j.job_id = a.job_id
       WHERE a.application_id=$1
       AND j.recruiter_id=$2`,
      [application_id, req.user.user_id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        error: "Application not found for this recruiter",
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
       AND application_status IS DISTINCT FROM $1
       RETURNING *`,
      [application_status, application_id]
    );

    if (result.rows.length === 0) {
      const latestResult = await pool.query(
        `SELECT *
         FROM applications
         WHERE application_id=$1`,
        [application_id]
      );

      return res.status(200).json({
        message: "Status already updated. No email was sent.",
        application: latestResult.rows[0] || currentApplication,
        email_delivery: {
          sent: false,
          configured: null,
          status: "skipped_unchanged",
        },
      });
    }

    const application = result.rows[0];
    let emailDelivery = null;

    if (application_status === "Shortlisted") {
      await createNotification({
        candidateId,
        message: "You have been shortlisted for the next hiring stage.",
        notificationType: "shortlisted",
        referenceType: "application",
        referenceId: Number(application_id),
      });

      emailDelivery = await deliverApplicationStatusEmail({
        candidateId,
        jobId,
        applicationStatus: "Shortlisted",
      });
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

      emailDelivery = await deliverApplicationStatusEmail({
        candidateId,
        jobId,
        applicationStatus: "Rejected",
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

    const emailMessage = emailDelivery
      ? ` ${getEmailDeliveryMessage(emailDelivery)}`
      : "";

    res.status(200).json({
      message: `Status updated.${emailMessage}`,
      application,
      email_delivery: emailDelivery,
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
