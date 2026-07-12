const express = require("express");

const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const { authorizeRole } = require("../middleware/roleMiddleware");

const {
  getMatchedExternalJobs,
  getMyExternalApplications,
  getExternalAgentLogs,
  getExternalAgentRuns,
  getExternalWorkerHealth,
  applyExternalJob,
  retryExternalAgentRun,
  cancelExternalAgentRun,
  completeExternalApplication,
  runSafeBrowserSmokeTest,
  resetSafeDummyExternalApplication,
  runCrawl4AiDemoDiscovery,
} = require("../controllers/externalJobController");

const authorizeDiscoveryTester = (req, res, next) => {
  if (!["candidate", "recruiter"].includes(req.user?.role)) {
    return res.status(403).json({
      error: "Candidate or recruiter access required",
    });
  }

  return next();
};

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

router.get(
  "/agent-runs",
  verifyToken,
  authorizeRole("candidate"),
  getExternalAgentRuns
);

router.get(
  "/worker-health",
  verifyToken,
  authorizeRole("candidate"),
  getExternalWorkerHealth
);

router.post(
  "/browser/smoke-test",
  verifyToken,
  authorizeRole("candidate"),
  runSafeBrowserSmokeTest
);

router.delete(
  "/safe-dummy/reset",
  verifyToken,
  authorizeRole("candidate"),
  resetSafeDummyExternalApplication
);

router.post(
  "/discovery/crawl4ai-demo",
  verifyToken,
  authorizeDiscoveryTester,
  runCrawl4AiDemoDiscovery
);

router.post(
  "/apply",
  verifyToken,
  authorizeRole("candidate"),
  applyExternalJob
);

router.post(
  "/agent-runs/:agentRunId/retry",
  verifyToken,
  authorizeRole("candidate"),
  retryExternalAgentRun
);

router.put(
  "/agent-runs/:agentRunId/cancel",
  verifyToken,
  authorizeRole("candidate"),
  cancelExternalAgentRun
);

router.put(
  "/complete",
  verifyToken,
  authorizeRole("candidate"),
  completeExternalApplication
);

module.exports = router;
