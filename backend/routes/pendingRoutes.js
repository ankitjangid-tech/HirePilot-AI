const express = require("express");

const router = express.Router();

const verifyToken =
require("../middleware/authMiddleware");

const {
createPendingApplication,
getPendingApplications
}=require("../controllers/pendingController");

router.post(
"/create",
verifyToken,
createPendingApplication
);

router.get(
"/all",
verifyToken,
getPendingApplications
);

module.exports=router;