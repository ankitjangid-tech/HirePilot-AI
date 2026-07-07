const express=require("express");

const router=express.Router();

const verifyToken=
require("../middleware/authMiddleware");

const {
authorizeRole
}=require("../middleware/roleMiddleware");

const {
getAllJobs
}=require("../controllers/jobListController");

router.get(
"/all",
verifyToken,
authorizeRole("candidate"),
getAllJobs
);

module.exports=router;