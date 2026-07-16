const pool = require("../config/db");

const createJob = async(req,res)=>{

    try{

        const recruiter_id = req.user.user_id;

        const{
            job_title,
            company_name,
            job_description,
            required_skills,
            experience_required,
            salary,
            location
        } = req.body;

        const companyResult = await pool.query(
        `SELECT verification_status
         FROM recruiter_companies
         WHERE recruiter_id = $1`,
        [recruiter_id]
        );
        const companyVerificationStatus =
        companyResult.rows[0]?.verification_status || "pending";
        const companyVerificationWarning =
        companyVerificationStatus === "verified"
        ? null
        : "Company profile is not verified yet. Company verification helps candidates trust your jobs.";

        const result = await pool.query(

        `INSERT INTO jobs
        (
        recruiter_id,
        job_title,
        company_name,
        job_description,
        required_skills,
        experience_required,
        salary,
        location
        )

        VALUES($1,$2,$3,$4,$5,$6,$7,$8)

        RETURNING *`,

        [
            recruiter_id,
            job_title,
            company_name,
            job_description,
            required_skills,
            experience_required,
            salary,
            location
        ]

        );

        res.status(201).json({
            message:"Job Created Successfully",
            job:result.rows[0],
            company_verification_status:companyVerificationStatus,
            company_verification_warning:companyVerificationWarning
        });

    }
    catch(error){

        console.log(error);

        res.status(500).json({
            error:"Job creation failed"
        });

    }

};

module.exports={createJob};
