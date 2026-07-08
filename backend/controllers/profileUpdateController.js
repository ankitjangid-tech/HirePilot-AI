const pool = require("../config/db");

const normalizeString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmedValue = String(value).trim();

  return trimmedValue === "" ? null : trimmedValue;
};

const normalizeExperienceYears = (value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numericValue = Number(value);

  return Number.isNaN(numericValue) ? null : numericValue;
};

const updateProfile = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      full_name,
      skills,
      experience_years,
      preferred_role,
      preferred_location,
      expected_salary,
      phone_number,
      current_location,
      address,
      linkedin_url,
      github_url,
      portfolio_url,
      education,
      projects,
      certifications,
      professional_summary,
    } = req.body;

    await client.query("BEGIN");

    const candidateCheck = await client.query(
      `SELECT candidate_id
       FROM candidates
       WHERE user_id = $1`,
      [req.user.user_id]
    );

    if (candidateCheck.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Candidate profile not found",
      });
    }

    const userResult = await client.query(
      `UPDATE users
       SET full_name = COALESCE(NULLIF($1, ''), full_name)
       WHERE user_id = $2
       RETURNING full_name, email`,
      [normalizeString(full_name), req.user.user_id]
    );

    const candidateResult = await client.query(
      `UPDATE candidates
       SET
        skills = $1,
        experience_years = $2,
        preferred_role = $3,
        preferred_location = $4,
        expected_salary = $5,
        phone_number = $6,
        current_location = $7,
        address = $8,
        linkedin_url = $9,
        github_url = $10,
        portfolio_url = $11,
        education = $12,
        projects = $13,
        certifications = $14,
        professional_summary = $15,
        profile_updated_at = NOW()
       WHERE user_id = $16
       RETURNING *`,
      [
        normalizeString(skills),
        normalizeExperienceYears(experience_years),
        normalizeString(preferred_role),
        normalizeString(preferred_location),
        normalizeString(expected_salary),
        normalizeString(phone_number),
        normalizeString(current_location),
        normalizeString(address),
        normalizeString(linkedin_url),
        normalizeString(github_url),
        normalizeString(portfolio_url),
        normalizeString(education),
        normalizeString(projects),
        normalizeString(certifications),
        normalizeString(professional_summary),
        req.user.user_id,
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Profile updated successfully",
      profile: {
        ...candidateResult.rows[0],
        full_name: userResult.rows[0]?.full_name,
        email: userResult.rows[0]?.email,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.log(error);

    return res.status(500).json({
      error: "Unable to update profile",
    });
  } finally {
    client.release();
  }
};

module.exports = {
  updateProfile,
};
