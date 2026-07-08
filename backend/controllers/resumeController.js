const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");
const pool = require("../config/db");

const uploadsDir = path.join(__dirname, "..", "uploads");

const normalizeResumeFilename = (resumeUrl) => {
  if (!resumeUrl) {
    return null;
  }

  const filename = path.basename(String(resumeUrl));

  if (!filename || filename !== String(resumeUrl)) {
    return null;
  }

  return filename;
};

const sendResumeFile = (res, resumeUrl, download = false) => {
  const filename = normalizeResumeFilename(resumeUrl);

  if (!filename) {
    return res.status(404).json({
      error: "Resume not uploaded",
    });
  }

  const filePath = path.join(uploadsDir, filename);
  const normalizedPath = path.normalize(filePath);

  if (!normalizedPath.startsWith(uploadsDir + path.sep)) {
    return res.status(400).json({
      error: "Invalid resume path",
    });
  }

  if (!fs.existsSync(normalizedPath)) {
    return res.status(404).json({
      error: "Resume file not found on server",
    });
  }

  const safeFilename = filename.replace(/["\\\r\n]/g, "");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="${safeFilename}"`
  );

  return res.sendFile(normalizedPath);
};

const uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Resume file is required",
      });
    }

    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    const resumeText = pdfData.text;

    const skills = [];

    const skillList = [
      "Python",
      "SQL",
      "React",
      "Java",
      "JavaScript",
      "HTML",
      "CSS",
      "Node.js",
      "Express",
      "PostgreSQL",
    ];

    skillList.forEach((skill) => {
      if (resumeText.toLowerCase().includes(skill.toLowerCase())) {
        skills.push(skill);
      }
    });

    let experience = "Not Found";

    const experiencePatterns = [
      /(\d+\.?\d*)\s*(year|years)/i,
      /(\d+\.?\d*)\s*(month|months)/i,
      /experience\s*[:-]?\s*(\d+\.?\d*\s*(year|years|month|months))/i,
      /total\s*experience\s*[:-]?\s*(\d+\.?\d*\s*(year|years|month|months))/i,
    ];

    for (const pattern of experiencePatterns) {
      const match = resumeText.match(pattern);

      if (match) {
        experience = match[0];
        break;
      }
    }

    let education = "Not Found";

    if (resumeText.toLowerCase().includes("mca")) {
      education = "MCA";
    } else if (resumeText.toLowerCase().includes("bsc")) {
      education = "BSc";
    } else if (resumeText.toLowerCase().includes("b.tech")) {
      education = "B.Tech";
    }

    let atsScore = 0;

    atsScore += skills.length * 10;

    if (education !== "Not Found") {
      atsScore += 20;
    }

    if (experience !== "Not Found") {
      atsScore += 30;
    }

    if (atsScore > 100) {
      atsScore = 100;
    }

    const experienceYears =
      experience === "Not Found" ? null : parseInt(experience.match(/\d+/)?.[0]);

    const updateResult = await pool.query(
      `UPDATE candidates
       SET
        skills = COALESCE(NULLIF($1, ''), skills),
        experience_years = COALESCE($2, experience_years),
        resume_url = $3,
        ats_score = $4
       WHERE user_id = $5
       RETURNING *`,
      [skills.join(","), experienceYears, req.file.filename, atsScore, req.user.user_id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    const parsedData = {
      skills,
      experience,
      education,
      ats_score: atsScore,
    };

    return res.status(200).json({
      message: "Resume uploaded successfully",
      file: req.file.filename,
      parsedData,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Upload failed",
    });
  }
};

const viewMyResume = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT resume_url
       FROM candidates
       WHERE user_id = $1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    return sendResumeFile(res, result.rows[0].resume_url, false);
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Unable to view resume",
    });
  }
};

const downloadMyResume = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT resume_url
       FROM candidates
       WHERE user_id = $1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    return sendResumeFile(res, result.rows[0].resume_url, true);
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Unable to download resume",
    });
  }
};

const viewApplicantResume = async (req, res) => {
  try {
    const { applicationId } = req.params;

    if (!applicationId) {
      return res.status(400).json({
        error: "applicationId is required",
      });
    }

    const result = await pool.query(
      `SELECT
        c.resume_url
       FROM applications a
       JOIN jobs j
       ON a.job_id = j.job_id
       JOIN candidates c
       ON a.candidate_id = c.candidate_id
       WHERE a.application_id = $1
       AND j.recruiter_id = $2`,
      [applicationId, req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Resume not found for this recruiter/application",
      });
    }

    return sendResumeFile(res, result.rows[0].resume_url, false);
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Unable to view applicant resume",
    });
  }
};

const downloadApplicantResume = async (req, res) => {
  try {
    const { applicationId } = req.params;

    if (!applicationId) {
      return res.status(400).json({
        error: "applicationId is required",
      });
    }

    const result = await pool.query(
      `SELECT
        c.resume_url
       FROM applications a
       JOIN jobs j
       ON a.job_id = j.job_id
       JOIN candidates c
       ON a.candidate_id = c.candidate_id
       WHERE a.application_id = $1
       AND j.recruiter_id = $2`,
      [applicationId, req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Resume not found for this recruiter/application",
      });
    }

    return sendResumeFile(res, result.rows[0].resume_url, true);
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Unable to download applicant resume",
    });
  }
};

module.exports = {
  uploadResume,
  viewMyResume,
  downloadMyResume,
  viewApplicantResume,
  downloadApplicantResume,
};
