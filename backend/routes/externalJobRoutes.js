const express=require("express");

const router=express.Router();

const verifyToken=
require("../middleware/authMiddleware");

const {
applyExternalJob
}=require("../controllers/externalJobController");

router.post(

"/apply",

verifyToken,

applyExternalJob

);

module.exports=router;