const express=require("express");

const router=express.Router();

const verifyToken=
require("../middleware/authMiddleware");

const {
getProfileStatus
}=require("../controllers/profileController");

router.get(

"/status",

verifyToken,

getProfileStatus

);

module.exports=router;