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
            job:result.rows[0]
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