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
job_id,
job_title,
company_name,
required_skills,
salary

FROM jobs
WHERE recruiter_id=$1`,

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
