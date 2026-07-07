const pool=require("../config/db");

const getMyJobs=async(req,res)=>{

try{

const recruiter_id=req.user.user_id;

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

module.exports={getMyJobs};