const express = require("express");

const router = express.Router();

const verifyToken =
require("../middleware/authMiddleware");

const {
authorizeRole
}=require("../middleware/roleMiddleware");

const {
createJob
}=require("../controllers/jobController");

const {
requireApprovedRecruiter
}=require("../middleware/recruiterApprovalMiddleware");

router.post(
"/create",
verifyToken,
authorizeRole("recruiter"),
requireApprovedRecruiter,
createJob
);

module.exports=router;
