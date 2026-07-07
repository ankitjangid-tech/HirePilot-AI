const express=require("express");

const router=express.Router();

const verifyToken=
require("../middleware/authMiddleware");

const {
authorizeRole
}=require("../middleware/roleMiddleware");

const {
getMyJobs
}=require("../controllers/myJobsController");

router.get(
"/my-jobs",
verifyToken,
authorizeRole("recruiter"),
getMyJobs
);

module.exports=router;