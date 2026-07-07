const express = require("express");

const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const { authorizeRole } = require("../middleware/roleMiddleware");

const {
  updateApplicationStatus,
} = require("../controllers/applicationStatusController");

router.put(
  "/update",
  verifyToken,
  authorizeRole("recruiter"),
  updateApplicationStatus
);

module.exports = router;
