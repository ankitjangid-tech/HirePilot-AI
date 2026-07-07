const pool=require("../config/db");

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
getApplicantsByJob
};