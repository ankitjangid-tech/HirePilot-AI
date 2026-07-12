const express = require("express");

const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const { authorizeRole } = require("../middleware/roleMiddleware");
const {
  getRecruiters,
  updateRecruiterStatus,
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

module.exports = router;
