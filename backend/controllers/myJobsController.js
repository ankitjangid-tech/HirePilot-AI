const pool=require("../config/db");

const getMyJobs=async(req,res)=>{

try{

const recruiter_id=req.user.user_id;

const recruiterResult=await pool.query(

`SELECT
COALESCE(recruiter_status, 'pending') AS recruiter_status,
recruiter_status_reason,
recruiter_status_updated_at
FROM users
WHERE user_id=$1
AND role='recruiter'`,

[recruiter_id]

);

if(recruiterResult.rows.length===0){

return res.status(404).json({
error:"Recruiter account not found"
});

}

const result=await pool.query(

`SELECT
j.job_id,
j.job_title,
j.company_name,
j.required_skills,
j.salary,
rc.verification_status AS company_verification_status

FROM jobs j
LEFT JOIN recruiter_companies rc
ON rc.recruiter_id = j.recruiter_id
WHERE j.recruiter_id=$1`,

[recruiter_id]

);

res.status(200).json({

jobs:result.rows,
recruiter_status:recruiterResult.rows[0].recruiter_status,
recruiter_status_reason:recruiterResult.rows[0].recruiter_status_reason,
recruiter_status_updated_at:recruiterResult.rows[0].recruiter_status_updated_at

});

}
catch(error){

console.log(error);

res.status(500).json({

error:"Unable to fetch jobs"

});

}

};

module.exports={getMyJobs};
