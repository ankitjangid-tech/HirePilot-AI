const express=require("express");

const router=express.Router();

const verifyToken=
require("../middleware/authMiddleware");

const {
authorizeRole
}=require("../middleware/roleMiddleware");

const {
autoApply
}=require("../controllers/autoApplyController");

router.post(

"/apply",

verifyToken,
authorizeRole("candidate"),

autoApply

);

module.exports=router;
