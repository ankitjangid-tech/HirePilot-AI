const express = require("express");

const router = express.Router();

const verifyToken =
require("../middleware/authMiddleware");

const {
authorizeRole
}=require("../middleware/roleMiddleware");
const {
autoApply,
getMyApplications
}=require("../controllers/applyController");

router.post(
"/apply",
verifyToken,
authorizeRole("candidate"),
autoApply
);

router.get(
"/my-applications",
verifyToken,
authorizeRole("candidate"),
getMyApplications
);

module.exports = router;