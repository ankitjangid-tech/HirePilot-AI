const express = require("express");

const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const { authorizeRole } = require("../middleware/roleMiddleware");

const {
  scheduleInterview,
  rescheduleInterview,
  cancelInterview,
  getMyInterviews,
} = require("../controllers/interviewController");

router.post(
  "/schedule",
  verifyToken,
  authorizeRole("recruiter"),
  scheduleInterview
);

router.put(
  "/:interviewId/reschedule",
  verifyToken,
  authorizeRole("recruiter"),
  rescheduleInterview
);

router.put(
  "/:interviewId/cancel",
  verifyToken,
  authorizeRole("recruiter"),
  cancelInterview
);

router.get(
  "/my-interviews",
  verifyToken,
  authorizeRole("candidate"),
  getMyInterviews
);

module.exports = router;
