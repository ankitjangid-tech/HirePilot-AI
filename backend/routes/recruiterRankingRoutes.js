const express = require("express");

const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const { authorizeRole } = require("../middleware/roleMiddleware");

const {
  rankApplicants,
} = require("../controllers/recruiterRankingController");

router.get(
  "/:jobId",
  verifyToken,
  authorizeRole("recruiter"),
  rankApplicants
);

module.exports = router;
