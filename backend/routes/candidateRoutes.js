const express = require("express");

const router = express.Router();

const {
createProfile
} = require("../controllers/candidateController");

const verifyToken =
require("../middleware/authMiddleware");

router.post(
"/profile",
verifyToken,
createProfile
);

module.exports=router;