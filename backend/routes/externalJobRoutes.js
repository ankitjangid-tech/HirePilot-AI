const express = require("express");

const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const { authorizeRole } = require("../middleware/roleMiddleware");

const {
  getMatchedExternalJobs,
  getMyExternalApplications,
  getExternalAgentLogs,
  applyExternalJob,
  completeExternalApplication,
} = require("../controllers/externalJobController");

router.get(
  "/matched",
  verifyToken,
  authorizeRole("candidate"),
  getMatchedExternalJobs
);

router.get(
  "/my-applications",
  verifyToken,
  authorizeRole("candidate"),
  getMyExternalApplications
);

router.get(
  "/agent-logs",
  verifyToken,
  authorizeRole("candidate"),
  getExternalAgentLogs
);

router.post(
  "/apply",
  verifyToken,
  authorizeRole("candidate"),
  applyExternalJob
);

router.put(
  "/complete",
  verifyToken,
  authorizeRole("candidate"),
  completeExternalApplication
);

module.exports = router;
