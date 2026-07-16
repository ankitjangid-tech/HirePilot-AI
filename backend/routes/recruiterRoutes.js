const express=require("express");

const router=express.Router();

const verifyToken=
require("../middleware/authMiddleware");

const {
authorizeRole
}=require("../middleware/roleMiddleware");
const {
getApplicants,
getApplicantsByJob,
getCompanyProfile,
upsertCompanyProfile
}=require("../controllers/recruiterController");

router.get(
"/company",
verifyToken,
authorizeRole("recruiter"),
getCompanyProfile
);

router.put(
"/company",
verifyToken,
authorizeRole("recruiter"),
upsertCompanyProfile
);

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
