const express=require("express");

const router=express.Router();

const verifyToken=
require("../middleware/authMiddleware");

const {
rankApplicants
}=require("../controllers/recruiterRankingController");

router.get(

"/:jobId",

verifyToken,

rankApplicants

);

module.exports=router;