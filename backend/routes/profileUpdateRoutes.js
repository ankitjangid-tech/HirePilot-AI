const express=require("express");

const router=express.Router();

const verifyToken=
require("../middleware/authMiddleware");

const {
updateProfile
}=require("../controllers/profileUpdateController");

router.put(

"/update",

verifyToken,

updateProfile

);

module.exports=router;