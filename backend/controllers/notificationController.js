const pool = require("../config/db");

const getCandidateIdFromUser = async (userId) => {
  const candidateResult = await pool.query(
    `SELECT candidate_id
     FROM candidates
     WHERE user_id=$1`,
    [userId]
  );

  return candidateResult.rows[0]?.candidate_id || null;
};

const createNotification = async ({
  candidateId,
  message,
  notificationType = "general",
  referenceType = null,
  referenceId = null,
  replaceExisting = false,
}) => {
  if (!candidateId || !message) {
    return null;
  }

  if (referenceType && referenceId) {
    const existingNotification = await pool.query(
      `SELECT notification_id
       FROM notifications
       WHERE candidate_id=$1
       AND notification_type=$2
       AND reference_type=$3
       AND reference_id=$4
       LIMIT 1`,
      [candidateId, notificationType, referenceType, referenceId]
    );

    if (existingNotification.rows.length > 0) {
      if (replaceExisting) {
        const updatedNotification = await pool.query(
          `UPDATE notifications
           SET message=$1,
               is_read=false,
               created_at=NOW(),
               updated_at=NOW()
           WHERE notification_id=$2
           RETURNING *`,
          [message, existingNotification.rows[0].notification_id]
        );

        return updatedNotification.rows[0];
      }

      return existingNotification.rows[0];
    }
  } else {
    const existingNotification = await pool.query(
      `SELECT notification_id
       FROM notifications
       WHERE candidate_id=$1
       AND notification_type=$2
       AND message=$3
       AND reference_type IS NULL
       AND reference_id IS NULL
       LIMIT 1`,
      [candidateId, notificationType, message]
    );

    if (existingNotification.rows.length > 0) {
      if (replaceExisting) {
        const updatedNotification = await pool.query(
          `UPDATE notifications
           SET message=$1,
               is_read=false,
               created_at=NOW(),
               updated_at=NOW()
           WHERE notification_id=$2
           RETURNING *`,
          [message, existingNotification.rows[0].notification_id]
        );

        return updatedNotification.rows[0];
      }

      return existingNotification.rows[0];
    }
  }

  const result = await pool.query(
    `INSERT INTO notifications
     (candidate_id, message, notification_type, is_read, reference_type, reference_id, updated_at)
     VALUES($1,$2,$3,false,$4,$5,NOW())
     RETURNING *`,
    [candidateId, message, notificationType, referenceType, referenceId]
  );

  return result.rows[0];
};

const getNotifications = async (req, res) => {
  try {
    const candidateId = await getCandidateIdFromUser(req.user.user_id);

    if (!candidateId) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    const notificationResult = await pool.query(
      `SELECT
        n.notification_id,
        n.message,
        n.created_at,
        COALESCE(n.notification_type,'general') AS notification_type,
        COALESCE(n.is_read,false) AS is_read,
        n.reference_type,
        n.reference_id,
        i.interview_date,
        i.interview_time,
        i.meeting_link,
        'notification' AS source_type
       FROM notifications n
       LEFT JOIN interviews i
       ON n.reference_type='interview'
       AND n.reference_id=i.interview_id
       WHERE n.candidate_id=$1
       AND (
        n.reference_type IS NULL
        OR n.reference_type<>'interview'
        OR (
          i.interview_id IS NOT NULL
          AND (
            COALESCE(i.status,'Scheduled')<>'Cancelled'
            OR n.notification_type='interview_cancelled'
          )
        )
       )
       ORDER BY n.created_at DESC, n.notification_id DESC`,
      [candidateId]
    );

    const interviewResult = await pool.query(
      `SELECT
        NULL::integer AS notification_id,
        'Your interview has been scheduled.' AS message,
        i.interview_date AS created_at,
        'interview_scheduled' AS notification_type,
        false AS is_read,
        'interview' AS reference_type,
        i.interview_id AS reference_id,
        i.interview_id,
        i.interview_date,
        i.interview_time,
        i.meeting_link,
        'interview' AS source_type
       FROM interviews i
       WHERE i.candidate_id=$1
       AND COALESCE(i.status,'Scheduled')<>'Cancelled'
       AND NOT EXISTS (
        SELECT 1
        FROM notifications n
        WHERE n.candidate_id=$1
        AND n.reference_type='interview'
        AND n.reference_id=i.interview_id
       )
       ORDER BY i.interview_date ASC`,
      [candidateId]
    );

    const notifications = [
      ...notificationResult.rows,
      ...interviewResult.rows,
    ].sort((a, b) => {
      const firstDate = new Date(a.created_at || a.interview_date || 0).getTime();
      const secondDate = new Date(b.created_at || b.interview_date || 0).getTime();
      return secondDate - firstDate;
    });

    const unreadCount = notifications.filter(
      (notification) => notification.notification_id && !notification.is_read
    ).length;

    res.status(200).json({
      notifications,
      unread_count: unreadCount,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Unable to fetch notifications",
    });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const { notification_id } = req.params;
    const candidateId = await getCandidateIdFromUser(req.user.user_id);

    if (!candidateId) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    const result = await pool.query(
      `UPDATE notifications
       SET is_read=true,
           updated_at=NOW()
       WHERE notification_id=$1
       AND candidate_id=$2
       RETURNING *`,
      [notification_id, candidateId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Notification not found",
      });
    }

    res.status(200).json({
      message: "Notification marked as read",
      notification: result.rows[0],
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Unable to mark notification as read",
    });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const candidateId = await getCandidateIdFromUser(req.user.user_id);

    if (!candidateId) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    const result = await pool.query(
      `UPDATE notifications
       SET is_read=true,
           updated_at=NOW()
       WHERE candidate_id=$1
       AND COALESCE(is_read,false)=false
       RETURNING notification_id`,
      [candidateId]
    );

    res.status(200).json({
      message: "All notifications marked as read",
      updated_count: result.rows.length,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Unable to mark notifications as read",
    });
  }
};

const cleanupDuplicateNotifications = async (req, res) => {
  try {
    const candidateId = await getCandidateIdFromUser(req.user.user_id);

    if (!candidateId) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    const result = await pool.query(
      `WITH ranked_notifications AS (
        SELECT
          notification_id,
          ROW_NUMBER() OVER (
            PARTITION BY
              candidate_id,
              message,
              COALESCE(notification_type,'general'),
              COALESCE(reference_type,''),
              COALESCE(reference_id,-1)
            ORDER BY created_at DESC, notification_id DESC
          ) AS row_number
        FROM notifications
        WHERE candidate_id=$1
      )
      DELETE FROM notifications n
      USING ranked_notifications r
      WHERE n.notification_id=r.notification_id
      AND r.row_number>1
      RETURNING n.notification_id`,
      [candidateId]
    );

    res.status(200).json({
      message: "Duplicate notifications cleaned",
      deleted_count: result.rows.length,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Unable to clean duplicate notifications",
    });
  }
};

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  cleanupDuplicateNotifications,
  createNotification,
};
