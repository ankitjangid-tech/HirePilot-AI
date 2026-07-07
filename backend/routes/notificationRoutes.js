const express = require("express");

const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const { authorizeRole } = require("../middleware/roleMiddleware");

const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  cleanupDuplicateNotifications,
} = require("../controllers/notificationController");

router.get(
  "/",
  verifyToken,
  authorizeRole("candidate"),
  getNotifications
);

router.put(
  "/mark-all-read",
  verifyToken,
  authorizeRole("candidate"),
  markAllNotificationsRead
);

router.put(
  "/:notification_id/read",
  verifyToken,
  authorizeRole("candidate"),
  markNotificationRead
);

router.delete(
  "/cleanup-duplicates",
  verifyToken,
  authorizeRole("candidate"),
  cleanupDuplicateNotifications
);

module.exports = router;
