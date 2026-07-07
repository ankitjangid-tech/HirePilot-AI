const express=require("express");

const router=express.Router();

const verifyToken=
require("../middleware/authMiddleware");

const {
authorizeRole
}=require("../middleware/roleMiddleware");
const {
getApplicants,
getApplicantsByJob
}=require("../controllers/recruiterController");

router.get(
"/applicants",
verifyToken,
authorizeRole("recruiter"),
getApplicants
);

router.get(
"/applicants/:job_id",
verifyToken,
authorizeRole("recruiter"),
getApplicantsByJob
);

module.exports=router;