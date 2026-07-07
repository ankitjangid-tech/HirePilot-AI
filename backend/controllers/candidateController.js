const pool = require("../config/db");

const createProfile = async(req,res)=>{

    try{

        // user_id token se automatically aayega
        const user_id = req.user.user_id;

        const {
            skills,
            experience_years,
            preferred_role,
            preferred_location,
            expected_salary,
            resume_url,
            ats_score
        } = req.body;

        const result = await pool.query(

        `INSERT INTO candidates
        (
            user_id,
            skills,
            experience_years,
            preferred_role,
            preferred_location,
            expected_salary,
            resume_url,
            ats_score
        )

        VALUES($1,$2,$3,$4,$5,$6,$7,$8)

        RETURNING *`,

        [
            user_id,
            skills,
            experience_years,
            preferred_role,
            preferred_location,
            expected_salary,
            resume_url,
            ats_score
        ]

        );

        res.status(201).json({
            message:"Profile Created",
            profile:result.rows[0]
        });

    }
    catch(error){

        console.log(error);

        res.status(500).json({
            error:"Profile creation failed"
        });

    }

};

module.exports = {createProfile};