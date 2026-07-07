const express=require("express");

const router=express.Router();

const verifyToken=
require("../middleware/authMiddleware");

const {
matchJobsV2
}=require("../controllers/aiMatchV2Controller");

router.get(

"/match-v2",

verifyToken,

matchJobsV2

);

module.exports=router;