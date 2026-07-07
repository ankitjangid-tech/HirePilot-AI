const pool = require("../config/db");
const { sendEmail } = require("../services/emailService");
const { createNotification } = require("./notificationController");

const scheduleInterview = async (req, res) => {
  try {
    const { application_id, interview_date, interview_time } = req.body;

    if (!application_id || !interview_date || !interview_time) {
      return res.status(400).json({
        error: "application_id, interview_date and interview_time are required",
      });
    }

    const applicationCheck = await pool.query(
      `SELECT
        application_status,
        candidate_id,
        job_id
       FROM applications
       WHERE application_id=$1`,
      [application_id]
    );

    if (applicationCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Application not found",
      });
    }

    const application = applicationCheck.rows[0];

    if (application.application_status === "Interview Scheduled") {
      return res.status(400).json({
        error: "Interview already scheduled for this application",
      });
    }

    if (application.application_status === "Rejected") {
      return res.status(400).json({
        error: "Cannot schedule interview for a rejected application",
      });
    }

    if (application.application_status !== "Shortlisted") {
      return res.status(400).json({
        error: "Candidate must be shortlisted before scheduling interview",
      });
    }

    const existingInterview = await pool.query(
      `SELECT interview_id
       FROM interviews
       WHERE candidate_id=$1
       AND job_id=$2
       AND COALESCE(status,'Scheduled')<>'Cancelled'`,
      [application.candidate_id, application.job_id]
    );

    if (existingInterview.rows.length > 0) {
      return res.status(400).json({
        error: "Interview already scheduled for this application",
      });
    }

    const meetingLink =
      "https://meet.google.com/" + Math.random().toString(36).substring(2, 10);

    await pool.query(
      `UPDATE applications
       SET application_status='Interview Scheduled'
       WHERE application_id=$1`,
      [application_id]
    );

    const result = await pool.query(
      `INSERT INTO interviews(
        candidate_id,
        job_id,
        interview_date,
        interview_time,
        meeting_link,
        status
       )
       VALUES($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        application.candidate_id,
        application.job_id,
        interview_date,
        interview_time,
        meetingLink,
        "Scheduled",
      ]
    );

    const interview = result.rows[0];

    await createNotification({
      candidateId: application.candidate_id,
      message: "Your interview has been scheduled.",
      notificationType: "interview_scheduled",
      referenceType: "interview",
      referenceId: interview.interview_id,
    });

    const userResult = await pool.query(
      `SELECT
        u.email,
        u.full_name
       FROM users u
       JOIN candidates c
       ON u.user_id=c.user_id
       WHERE c.candidate_id=$1`,
      [application.candidate_id]
    );

    const user = userResult.rows[0];

    if (user) {
      await sendEmail(
        user.email,
        "HirePilot AI - Interview Scheduled",
        `
        <h2>Hello ${user.full_name}</h2>
        <p>Your interview has been scheduled.</p>
        <p>Date: ${interview_date}</p>
        <p>Time: ${interview_time}</p>
        <p>Meeting Link: <a href="${meetingLink}">Join Interview</a></p>
        `
      );
    }

    res.status(201).json({
      message: "Interview Scheduled",
      interview,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Interview scheduling failed",
    });
  }
};

const getMyInterviews = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const candidate = await pool.query(
      `SELECT candidate_id
       FROM candidates
       WHERE user_id=$1`,
      [user_id]
    );

    if (candidate.rows.length === 0) {
      return res.status(404).json({
        error: "Candidate not found",
      });
    }

    const candidate_id = candidate.rows[0].candidate_id;

    const result = await pool.query(
      `SELECT
        i.interview_id,
        i.interview_date,
        i.interview_time,
        i.meeting_link,
        i.status,
        j.job_title,
        j.company_name
       FROM interviews i
       JOIN jobs j
       ON i.job_id=j.job_id
       WHERE i.candidate_id=$1
       AND COALESCE(i.status,'Scheduled')<>'Cancelled'
       ORDER BY i.interview_date ASC`,
      [candidate_id]
    );

    res.status(200).json({
      interviews: result.rows,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Unable to fetch interviews",
    });
  }
};

module.exports = {
  scheduleInterview,
  getMyInterviews,
};
