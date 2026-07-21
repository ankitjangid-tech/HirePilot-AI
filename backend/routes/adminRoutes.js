const express = require("express");

const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const { authorizeRole } = require("../middleware/roleMiddleware");
const {
  getRecruiters,
  updateRecruiterStatus,
  getExternalJobs,
  reviewExternalJob,
  getExternalSources,
  createExternalSource,
  updateExternalSource,
  getRecruiterCompanies,
  updateCompanyVerification,
  runCrawl4AiDemoDiscovery,
  runAllowlistedSourceDiscovery,
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

router.get(
  "/external-sources",
  verifyToken,
  authorizeRole("admin"),
  getExternalSources
);

router.post(
  "/external-sources",
  verifyToken,
  authorizeRole("admin"),
  createExternalSource
);

router.patch(
  "/external-sources/:sourceId",
  verifyToken,
  authorizeRole("admin"),
  updateExternalSource
);

router.get(
  "/companies",
  verifyToken,
  authorizeRole("admin"),
  getRecruiterCompanies
);

router.patch(
  "/companies/:companyId/verification",
  verifyToken,
  authorizeRole("admin"),
  updateCompanyVerification
);

router.post(
  "/discovery/crawl4ai-demo",
  verifyToken,
  authorizeRole("admin"),
  runCrawl4AiDemoDiscovery
);

router.post(
  "/external-sources/:sourceId/run-discovery",
  verifyToken,
  authorizeRole("admin"),
  runAllowlistedSourceDiscovery
);

module.exports = router;
