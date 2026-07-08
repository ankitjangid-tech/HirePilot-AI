const pool = require("../config/db");

const requiredProfileFields = [
  "skills",
  "experience_years",
  "preferred_role",
  "preferred_location",
  "expected_salary",
];

const optionalProfileFields = [
  "full_name",
  "email",
  "phone_number",
  "current_location",
  "address",
  "linkedin_url",
  "github_url",
  "portfolio_url",
  "education",
  "projects",
  "certifications",
  "professional_summary",
  "resume_url",
];

const isMissingField = (field, value) => {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string" && value.trim() === "") {
    return true;
  }

  if (field === "expected_salary" && Number(value) <= 0) {
    return true;
  }

  if (field === "experience_years" && Number(value) < 0) {
    return true;
  }

  return false;
};

const getProfileStatus = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        c.candidate_id,
        c.skills,
        c.experience_years,
        c.preferred_role,
        c.preferred_location,
        c.expected_salary,
        c.resume_url,
        c.ats_score,
        c.created_at,
        c.phone_number,
        c.current_location,
        c.address,
        c.linkedin_url,
        c.github_url,
        c.portfolio_url,
        c.education,
        c.projects,
        c.certifications,
        c.professional_summary,
        c.profile_updated_at,
        u.full_name,
        u.email
       FROM candidates c
       JOIN users u
       ON c.user_id = u.user_id
       WHERE c.user_id = $1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    const profile = result.rows[0];

    const missingFields = requiredProfileFields.filter((field) =>
      isMissingField(field, profile[field])
    );

    const completedFields = requiredProfileFields.filter(
      (field) => !missingFields.includes(field)
    );

    return res.status(200).json({
      profile,
      profile_completed: missingFields.length === 0,
      missing_fields: missingFields,
      completed_fields: completedFields,
      required_fields: requiredProfileFields,
      optional_fields: optionalProfileFields,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Unable to fetch profile",
    });
  }
};

module.exports = {
  getProfileStatus,
};
