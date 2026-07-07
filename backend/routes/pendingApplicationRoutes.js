const express = require("express");

const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");

const {
  getPendingApplications,
  completeApplication,
} = require("../controllers/pendingApplicationController");

const {
  authorizeRole,
} = require("../middleware/roleMiddleware");

router.get(
  "/",
  verifyToken,
  authorizeRole("candidate"),
  getPendingApplications
);

router.put(
  "/complete",
  verifyToken,
  authorizeRole("candidate"),
  completeApplication
);

module.exports = router;