const pool=require("../config/db");

const getAllJobs=async(req,res)=>{

try{

const result=await pool.query(

`SELECT
j.job_id,
j.job_title,
j.company_name,
j.required_skills,
j.experience_required,
j.salary,
rc.verification_status AS company_verification_status

FROM jobs j
LEFT JOIN recruiter_companies rc
ON rc.recruiter_id = j.recruiter_id`

);

res.status(200).json({

jobs:result.rows

});

}
catch(error){

console.log(error);

res.status(500).json({

error:"Unable to fetch jobs"

});

}

};

module.exports={getAllJobs};
