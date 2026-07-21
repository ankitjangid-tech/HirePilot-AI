const pool = require("../config/db");
const {
  buildEmailHtml,
  getEmailDeliveryMessage,
  sendEmail,
} = require("../services/emailService");
const { createNotification } = require("./notificationController");

const buildMeetingLink = () =>
  "https://meet.google.com/" + Math.random().toString(36).substring(2, 10);

const normalizeDateValue = (value) => {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
};

const normalizeTimeValue = (value) =>
  value ? String(value).slice(0, 5) : "";

const getCandidateUser = async (candidateId) => {
  const userResult = await pool.query(
    `SELECT
      u.email,
      u.full_name
     FROM users u
     JOIN candidates c
     ON u.user_id=c.user_id
     WHERE c.candidate_id=$1`,
    [candidateId]
  );

  return userResult.rows[0] || null;
};

const sendInterviewEmail = async ({
  candidateId,
  subject,
  heading,
  message,
  interviewDate,
  interviewTime,
  meetingLink,
}) => {
  try {
    const user = await getCandidateUser(candidateId);

    if (!user) {
      return sendEmail(null, subject, "");
    }

    return sendEmail(
      user.email,
      subject,
      buildEmailHtml({
        recipientName: user.full_name,
        title: heading,
        paragraphs: [message],
        details: [
          { label: "Date", value: interviewDate },
          { label: "Time", value: interviewTime },
          { label: "Meeting link", value: meetingLink },
        ],
      })
    );
  } catch (error) {
    console.warn(
      "[EMAIL] Interview notification preparation failed. The interview update remains complete."
    );
    return {
      sent: false,
      configured: null,
      status: "failed",
    };
  }
};

const getOwnedApplication = async (applicationId, recruiterUserId) => {
  const result = await pool.query(
    `SELECT
      a.application_id,
      a.application_status,
      a.candidate_id,
      a.job_id,
      j.job_title,
      j.company_name
     FROM applications a
     JOIN jobs j
     ON a.job_id=j.job_id
     WHERE a.application_id=$1
     AND j.recruiter_id=$2`,
    [applicationId, recruiterUserId]
  );

  return result.rows[0] || null;
};

const getOwnedInterview = async (interviewId, recruiterUserId) => {
  const result = await pool.query(
    `SELECT
      i.interview_id,
      i.candidate_id,
      i.job_id,
      i.interview_date,
      i.interview_time,
      i.meeting_link,
      i.status,
      j.job_title,
      j.company_name,
      a.application_id,
      a.application_status
     FROM interviews i
     JOIN jobs j
     ON i.job_id=j.job_id
     LEFT JOIN applications a
     ON a.candidate_id=i.candidate_id
     AND a.job_id=i.job_id
     WHERE i.interview_id=$1
     AND j.recruiter_id=$2`,
    [interviewId, recruiterUserId]
  );

  return result.rows[0] || null;
};

const scheduleInterview = async (req, res) => {
  try {
    const { application_id, interview_date, interview_time } = req.body;
    const recruiterUserId = req.user.user_id;

    if (!application_id || !interview_date || !interview_time) {
      return res.status(400).json({
        error: "application_id, interview_date and interview_time are required",
      });
    }

    const application = await getOwnedApplication(application_id, recruiterUserId);

    if (!application) {
      return res.status(404).json({
        error: "Application not found for this recruiter",
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
      `SELECT *
       FROM interviews
       WHERE candidate_id=$1
       AND job_id=$2
       AND COALESCE(status,'Scheduled')<>'Cancelled'
       ORDER BY interview_date DESC, interview_time DESC
       LIMIT 1`,
      [application.candidate_id, application.job_id]
    );

    if (existingInterview.rows.length > 0) {
      return res.status(400).json({
        error: "Interview already scheduled for this application",
        interview: existingInterview.rows[0],
      });
    }

    const meetingLink = buildMeetingLink();

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

    const emailDelivery = await sendInterviewEmail({
      candidateId: application.candidate_id,
      subject: "HirePilot AI - Interview Scheduled",
      heading: "Your interview has been scheduled.",
      message: `${application.company_name} scheduled your interview for ${application.job_title}.`,
      interviewDate: interview_date,
      interviewTime: interview_time,
      meetingLink,
    });

    return res.status(201).json({
      message: `Interview scheduled. ${getEmailDeliveryMessage(emailDelivery)}`,
      interview,
      email_delivery: emailDelivery,
      application: {
        application_id: Number(application_id),
        application_status: "Interview Scheduled",
      },
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Interview scheduling failed",
    });
  }
};

const rescheduleInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { interview_date, interview_time } = req.body;
    const recruiterUserId = req.user.user_id;

    if (!interviewId || !interview_date || !interview_time) {
      return res.status(400).json({
        error: "interviewId, interview_date and interview_time are required",
      });
    }

    const interview = await getOwnedInterview(interviewId, recruiterUserId);

    if (!interview) {
      return res.status(404).json({
        error: "Interview not found for this recruiter",
      });
    }

    if (interview.status === "Cancelled") {
      return res.status(400).json({
        error: "Cancelled interview cannot be rescheduled",
      });
    }

    if (
      normalizeDateValue(interview.interview_date) ===
        normalizeDateValue(interview_date) &&
      normalizeTimeValue(interview.interview_time) ===
        normalizeTimeValue(interview_time)
    ) {
      return res.status(200).json({
        message: "Interview date and time are already up to date. No email was sent.",
        interview,
        email_delivery: {
          sent: false,
          configured: null,
          status: "skipped_unchanged",
        },
        application: {
          application_id: interview.application_id,
          application_status: "Interview Scheduled",
        },
      });
    }

    const result = await pool.query(
      `UPDATE interviews
       SET interview_date=$1,
           interview_time=$2,
           status='Rescheduled'
       WHERE interview_id=$3
       RETURNING *`,
      [interview_date, interview_time, interviewId]
    );

    const updatedInterview = result.rows[0];

    if (interview.application_id) {
      await pool.query(
        `UPDATE applications
         SET application_status='Interview Scheduled'
         WHERE application_id=$1`,
        [interview.application_id]
      );
    }

    await createNotification({
      candidateId: interview.candidate_id,
      message: "Your interview has been rescheduled.",
      notificationType: "interview_rescheduled",
      referenceType: "interview",
      referenceId: Number(interviewId),
      replaceExisting: true,
    });

    const emailDelivery = await sendInterviewEmail({
      candidateId: interview.candidate_id,
      subject: "HirePilot AI - Interview Rescheduled",
      heading: "Your interview has been rescheduled.",
      message: `${interview.company_name} updated your interview for ${interview.job_title}.`,
      interviewDate: interview_date,
      interviewTime: interview_time,
      meetingLink: updatedInterview.meeting_link,
    });

    return res.status(200).json({
      message: `Interview rescheduled. ${getEmailDeliveryMessage(emailDelivery)}`,
      interview: updatedInterview,
      email_delivery: emailDelivery,
      application: {
        application_id: interview.application_id,
        application_status: "Interview Scheduled",
      },
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Interview rescheduling failed",
    });
  }
};

const cancelInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const recruiterUserId = req.user.user_id;

    if (!interviewId) {
      return res.status(400).json({
        error: "interviewId is required",
      });
    }

    const interview = await getOwnedInterview(interviewId, recruiterUserId);

    if (!interview) {
      return res.status(404).json({
        error: "Interview not found for this recruiter",
      });
    }

    if (interview.status === "Cancelled") {
      return res.status(200).json({
        message: "Interview already cancelled",
        interview,
      });
    }

    const result = await pool.query(
      `UPDATE interviews
       SET status='Cancelled'
       WHERE interview_id=$1
       RETURNING *`,
      [interviewId]
    );

    const cancelledInterview = result.rows[0];

    if (interview.application_id && interview.application_status === "Interview Scheduled") {
      await pool.query(
        `UPDATE applications
         SET application_status='Shortlisted'
         WHERE application_id=$1`,
        [interview.application_id]
      );
    }

    await createNotification({
      candidateId: interview.candidate_id,
      message: "Your interview has been cancelled. The recruiter may contact you with next steps.",
      notificationType: "interview_cancelled",
      referenceType: "interview",
      referenceId: Number(interviewId),
      replaceExisting: true,
    });

    const emailDelivery = await sendInterviewEmail({
      candidateId: interview.candidate_id,
      subject: "HirePilot AI - Interview Cancelled",
      heading: "Your interview has been cancelled.",
      message: `${interview.company_name} cancelled the interview for ${interview.job_title}. The recruiter may contact you with next steps.`,
    });

    return res.status(200).json({
      message: `Interview cancelled. ${getEmailDeliveryMessage(emailDelivery)}`,
      interview: cancelledInterview,
      email_delivery: emailDelivery,
      application: {
        application_id: interview.application_id,
        application_status: "Shortlisted",
      },
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Interview cancellation failed",
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
       ORDER BY i.interview_date ASC, i.interview_time ASC`,
      [candidate_id]
    );

    return res.status(200).json({
      interviews: result.rows,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Unable to fetch interviews",
    });
  }
};

module.exports = {
  scheduleInterview,
  rescheduleInterview,
  cancelInterview,
  getMyInterviews,
};
