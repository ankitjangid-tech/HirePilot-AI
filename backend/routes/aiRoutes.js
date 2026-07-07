const express = require("express");

const router = express.Router();

const verifyToken =
require("../middleware/authMiddleware");

const {
matchJobs
}=require("../controllers/aiController");

router.get(
"/match-jobs",
verifyToken,
matchJobs
);

module.exports = router;