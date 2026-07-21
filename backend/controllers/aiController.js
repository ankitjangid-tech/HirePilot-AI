const pool = require("../config/db");
const { calculatePercentageScore } = require("../services/matchingService");

const matchJobs = async (req, res) => {
  try {
    const candidateResult = await pool.query(
      `SELECT
        candidate_id,
        skills,
        preferred_role,
        experience_years
       FROM candidates
       WHERE user_id = $1`,
      [req.user.user_id]
    );

    if (candidateResult.rows.length === 0) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    const candidate = candidateResult.rows[0];
    const jobsResult = await pool.query(
      `SELECT
        job_id,
        job_title,
        company_name,
        required_skills,
        experience_required
       FROM jobs`
    );

    const matchedJobs = jobsResult.rows.map((job) => {
      const match = calculatePercentageScore(
        candidate.skills,
        job.required_skills
      );

      return {
        job_id: job.job_id,
        job_title: job.job_title,
        company_name: job.company_name,
        match_score: match.matchScore,
        matched_skills: match.matchedSkills.map((skill) => skill.label),
        missing_skills: match.missingSkills.map((skill) => skill.label),
      };
    });

    return res.status(200).json({
      matchedJobs,
    });
  } catch (error) {
    console.log("JOB MATCH ERROR:", error.message);

    return res.status(500).json({
      error: "Matching failed",
    });
  }
};

module.exports = { matchJobs };
