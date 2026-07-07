const pool=require("../config/db");

const getAllJobs=async(req,res)=>{

try{

const result=await pool.query(

`SELECT
job_id,
job_title,
company_name,
required_skills,
experience_required,
salary

FROM jobs`

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