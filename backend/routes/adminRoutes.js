const express = require("express");

const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const { authorizeRole } = require("../middleware/roleMiddleware");
const {
  getRecruiters,
  updateRecruiterStatus,
  getExternalJobs,
  reviewExternalJob,
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

module.exports = router;
