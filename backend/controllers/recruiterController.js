const pool=require("../config/db");

const COMPANY_PROFILE_FIELDS = [
  "company_name",
  "company_website",
  "industry",
  "company_size",
  "headquarters_location",
  "company_description",
];

const normalizeCompanyValue = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value).trim() || null;
};

const getCompanyProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        company_id,
        recruiter_id,
        company_name,
        company_website,
        industry,
        company_size,
        headquarters_location,
        company_description,
        verification_status,
        verification_notes,
        verified_by,
        verified_at,
        created_at,
        updated_at
       FROM recruiter_companies
       WHERE recruiter_id = $1`,
      [req.user.user_id]
    );

    return res.status(200).json({
      company: result.rows[0] || null,
    });
  } catch (error) {
    console.log("RECRUITER COMPANY FETCH ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to fetch company profile",
    });
  }
};

const upsertCompanyProfile = async (req, res) => {
  try {
    const companyProfile = COMPANY_PROFILE_FIELDS.reduce((profile, field) => {
      profile[field] = normalizeCompanyValue(req.body[field]);
      return profile;
    }, {});

    if (!companyProfile.company_name) {
      return res.status(400).json({
        error: "Company name is required",
      });
    }

    const existingResult = await pool.query(
      `SELECT *
       FROM recruiter_companies
       WHERE recruiter_id = $1`,
      [req.user.user_id]
    );
    const existingCompany = existingResult.rows[0] || null;
    const materialChange = Boolean(
      existingCompany &&
        COMPANY_PROFILE_FIELDS.some(
          (field) =>
            normalizeCompanyValue(existingCompany[field]) !==
            companyProfile[field]
        )
    );
    const requiresReview = Boolean(
      materialChange && existingCompany?.verification_status === "verified"
    );

    const result = await pool.query(
      `INSERT INTO recruiter_companies (
        recruiter_id,
        company_name,
        company_website,
        industry,
        company_size,
        headquarters_location,
        company_description
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (recruiter_id)
       DO UPDATE SET
         company_name = EXCLUDED.company_name,
         company_website = EXCLUDED.company_website,
         industry = EXCLUDED.industry,
         company_size = EXCLUDED.company_size,
         headquarters_location = EXCLUDED.headquarters_location,
         company_description = EXCLUDED.company_description,
         verification_status = CASE
           WHEN $8 = TRUE THEN 'needs_review'
           ELSE recruiter_companies.verification_status
         END,
         verified_by = CASE
           WHEN $8 = TRUE THEN NULL
           ELSE recruiter_companies.verified_by
         END,
         verified_at = CASE
           WHEN $8 = TRUE THEN NULL
           ELSE recruiter_companies.verified_at
         END,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        req.user.user_id,
        companyProfile.company_name,
        companyProfile.company_website,
        companyProfile.industry,
        companyProfile.company_size,
        companyProfile.headquarters_location,
        companyProfile.company_description,
        requiresReview,
      ]
    );

    return res.status(existingCompany ? 200 : 201).json({
      message: requiresReview
        ? "Company profile updated and marked for verification review."
        : existingCompany
        ? "Company profile updated."
        : "Company profile created and submitted for verification.",
      company: result.rows[0],
    });
  } catch (error) {
    console.log("RECRUITER COMPANY SAVE ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to save company profile",
    });
  }
};

const getApplicants=async(req,res)=>{

try{

const result=await pool.query(

`SELECT

a.application_id,
a.application_status,

c.candidate_id,
u.full_name,

j.job_title,
j.company_name

FROM applications a

JOIN candidates c
ON a.candidate_id=c.candidate_id

JOIN users u
ON c.user_id=u.user_id

JOIN jobs j
ON a.job_id=j.job_id`

);

res.status(200).json({

applicants:result.rows

});

}
catch(error){

console.log(error);

res.status(500).json({

error:"Unable to fetch applicants"

});

}

};

const getApplicantsByJob=async(req,res)=>{

try{

const {job_id}=req.params;

const result=await pool.query(

`SELECT

a.application_id,
a.application_status,

u.full_name,
j.job_title

FROM applications a

JOIN candidates c
ON a.candidate_id=c.candidate_id

JOIN users u
ON c.user_id=u.user_id

JOIN jobs j
ON a.job_id=j.job_id

WHERE a.job_id=$1`,

[job_id]

);

res.status(200).json({

applicants:result.rows

});

}
catch(error){

console.log(error);

res.status(500).json({

error:"Unable to fetch applicants"

});

}

};

module.exports={
getApplicants,
getApplicantsByJob,
getCompanyProfile,
upsertCompanyProfile
};
