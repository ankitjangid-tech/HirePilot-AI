const express = require("express");

const router = express.Router();

const verifyToken =
require("../middleware/authMiddleware");

const {
authorizeRole
}=require("../middleware/roleMiddleware");

const {
createJob
}=require("../controllers/jobController");

router.post(
"/create",
verifyToken,
authorizeRole("recruiter"),
createJob
);

module.exports=router;