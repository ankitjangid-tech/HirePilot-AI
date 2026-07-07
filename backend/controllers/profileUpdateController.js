const pool = require("../config/db");

const updateProfile = async (req, res) => {
  try {
    const {
      skills,
      experience_years,
      preferred_role,
      preferred_location,
      expected_salary,
    } = req.body;

    const normalizedExperienceYears =
      experience_years === "" ||
      experience_years === null ||
      experience_years === undefined
        ? null
        : Number(experience_years);

    const result = await pool.query(
      `UPDATE candidates
       SET
        skills = COALESCE(NULLIF($1, ''), skills),
        experience_years = $2,
        preferred_role = $3,
        preferred_location = $4,
        expected_salary = $5
       WHERE user_id = $6
       RETURNING *`,
      [
        skills,
        normalizedExperienceYears,
        preferred_role,
        preferred_location,
        expected_salary,
        req.user.user_id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      profile: result.rows[0],
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Unable to update profile",
    });
  }
};

module.exports = {
  updateProfile,
};