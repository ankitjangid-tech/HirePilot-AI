const express = require("express");

const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const { authorizeRole } = require("../middleware/roleMiddleware");

const {
  scheduleInterview,
  getMyInterviews,
} = require("../controllers/interviewController");

router.post(
  "/schedule",
  verifyToken,
  authorizeRole("recruiter"),
  scheduleInterview
);

router.get(
  "/my-interviews",
  verifyToken,
  authorizeRole("candidate"),
  getMyInterviews
);

module.exports = router;
