const pool = require("../config/db");

const CONTACT_VISIBLE_STATUSES = new Set([
  "Shortlisted",
  "Interview Scheduled",
  "Selected",
]);

const normalizeSkills = (skillsText) => {
  if (!skillsText) {
    return [];
  }

  return String(skillsText)
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
};

const rankApplicants = async (req, res) => {
  try {
    const { jobId } = req.params;
    const recruiterUserId = req.user.user_id;

    if (!jobId) {
      return res.status(400).json({
        error: "jobId is required",
      });
    }

    /*
      Project-specific schema note:
      jobs.recruiter_id currently stores the logged-in recruiter user's user_id.
      Do not join recruiters here unless the schema is changed later.
    */
    const jobCheck = await pool.query(
      `SELECT
        job_id,
        job_title,
        company_name,
        required_skills,
        experience_required,
        salary,
        location
       FROM jobs
       WHERE job_id = $1
       AND recruiter_id = $2`,
      [jobId, recruiterUserId]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Job not found for this recruiter",
      });
    }

    const job = jobCheck.rows[0];
    const requiredSkills = normalizeSkills(job.required_skills);

    const result = await pool.query(
      `SELECT DISTINCT ON (c.candidate_id)
        a.application_id,
        a.job_id,
        a.application_status,
        a.applied_at,

        c.candidate_id,
        c.skills,
        c.experience_years,
        c.preferred_role,
        c.preferred_location,
        c.expected_salary,
        c.resume_url,
        c.ats_score,
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

        u.full_name,
        u.email,

        i.interview_id,
        i.interview_date,
        i.interview_time,
        i.meeting_link,
        i.status AS interview_status
       FROM applications a
       JOIN candidates c
       ON a.candidate_id = c.candidate_id
       JOIN users u
       ON c.user_id = u.user_id
       LEFT JOIN LATERAL (
        SELECT
          interview_id,
          interview_date,
          interview_time,
          meeting_link,
          status
        FROM interviews
        WHERE candidate_id = c.candidate_id
        AND job_id = a.job_id
        AND COALESCE(status, 'Scheduled') <> 'Cancelled'
        ORDER BY interview_date DESC, interview_time DESC
        LIMIT 1
       ) i ON true
       WHERE a.job_id = $1
       ORDER BY c.candidate_id, a.application_id DESC`,
      [jobId]
    );

    const rankedCandidates = result.rows.map((candidate) => {
      const candidateSkills = normalizeSkills(candidate.skills);
      const candidateSkillLowerSet = new Set(
        candidateSkills.map((skill) => skill.toLowerCase())
      );

      const matchedSkills = requiredSkills.filter((skill) =>
        candidateSkillLowerSet.has(skill.toLowerCase())
      );

      const missingSkills = requiredSkills.filter(
        (skill) => !candidateSkillLowerSet.has(skill.toLowerCase())
      );

      const atsScore = Number(candidate.ats_score || 0);
      const experienceYears = Number(candidate.experience_years || 0);
      const experienceScore = experienceYears * 10;
      const skillMatchScore = matchedSkills.length * 10;
      const missingSkillPenalty = missingSkills.length * 3;

      const rankingScore = Math.max(
        0,
        atsScore + experienceScore + skillMatchScore - missingSkillPenalty
      );

      const contactVisible = CONTACT_VISIBLE_STATUSES.has(
        candidate.application_status
      );

      return {
        application_id: candidate.application_id,
        job_id: candidate.job_id,
        candidate_id: candidate.candidate_id,

        full_name: candidate.full_name,
        email: contactVisible ? candidate.email : null,
        phone_number: contactVisible ? candidate.phone_number : null,
        address: contactVisible ? candidate.address : null,
        contact_visible: contactVisible,

        skills: candidate.skills,
        experience_years: candidate.experience_years,
        preferred_role: candidate.preferred_role,
        preferred_location: candidate.preferred_location,
        expected_salary: candidate.expected_salary,
        resume_url: candidate.resume_url,
        ats_score: candidate.ats_score,
        current_location: candidate.current_location,
        linkedin_url: candidate.linkedin_url,
        github_url: candidate.github_url,
        portfolio_url: candidate.portfolio_url,
        education: candidate.education,
        projects: candidate.projects,
        certifications: candidate.certifications,
        professional_summary: candidate.professional_summary,

        application_status: candidate.application_status,
        applied_at: candidate.applied_at,

        ranking_score: rankingScore,
        matched_skills: matchedSkills,
        missing_skills: missingSkills,
        score_breakdown: {
          ats_score: atsScore,
          skill_match_score: skillMatchScore,
          experience_score: experienceScore,
          missing_skill_penalty: missingSkillPenalty,
        },

        has_interview: Boolean(candidate.interview_id),
        interview_scheduled: Boolean(candidate.interview_id),
        interview_id: candidate.interview_id,
        interview_date: candidate.interview_date,
        interview_time: candidate.interview_time,
        meeting_link: candidate.meeting_link,
        interview_status: candidate.interview_status,
      };
    });

    rankedCandidates.sort((a, b) => b.ranking_score - a.ranking_score);

    return res.status(200).json({
      job,
      rankedCandidates,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Unable to rank applicants",
    });
  }
};

module.exports = {
  rankApplicants,
};
