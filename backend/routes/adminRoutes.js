const express = require("express");

const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const { authorizeRole } = require("../middleware/roleMiddleware");
const {
  getRecruiters,
  updateRecruiterStatus,
  getExternalJobs,
  reviewExternalJob,
  runCrawl4AiDemoDiscovery,
} = require("../controllers/adminController");

router.get(
  "/recruiters",
  verifyToken,
  authorizeRole("admin"),
  getRecruiters
);

router.patch(
  "/recruiters/:userId/status",
  verifyToken,
  authorizeRole("admin"),
  updateRecruiterStatus
);

router.get(
  "/external-jobs",
  verifyToken,
  authorizeRole("admin"),
  getExternalJobs
);

router.patch(
  "/external-jobs/:externalJobId/review",
  verifyToken,
  authorizeRole("admin"),
  reviewExternalJob
);

router.post(
  "/discovery/crawl4ai-demo",
  verifyToken,
  authorizeRole("admin"),
  runCrawl4AiDemoDiscovery
);

module.exports = router;
