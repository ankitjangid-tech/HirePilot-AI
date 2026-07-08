const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const { authorizeRole } = require("../middleware/roleMiddleware");

const {
  uploadResume,
  viewMyResume,
  downloadMyResume,
  viewApplicantResume,
  downloadApplicantResume,
} = require("../controllers/resumeController");

const uploadDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeOriginalName}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF resumes are allowed"));
    }

    return cb(null, true);
  },
});

router.post(
  "/upload",
  verifyToken,
  authorizeRole("candidate"),
  upload.single("resume"),
  uploadResume
);

router.get(
  "/my-resume",
  verifyToken,
  authorizeRole("candidate"),
  viewMyResume
);

router.get(
  "/my-resume/download",
  verifyToken,
  authorizeRole("candidate"),
  downloadMyResume
);

router.get(
  "/applicant/:applicationId",
  verifyToken,
  authorizeRole("recruiter"),
  viewApplicantResume
);

router.get(
  "/applicant/:applicationId/download",
  verifyToken,
  authorizeRole("recruiter"),
  downloadApplicantResume
);

module.exports = router;
