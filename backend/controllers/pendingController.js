const pool = require("../config/db");

const createPendingApplication = async(req,res)=>{

try{

const user_id=req.user.user_id;

const candidate=await pool.query(

`SELECT candidate_id
FROM candidates
WHERE user_id=$1`,
[user_id]

);

const candidate_id=
candidate.rows[0].candidate_id;

const{
external_job_title,
company_name,
failure_reason
}=req.body;

const result=await pool.query(

`INSERT INTO pending_applications
(
candidate_id,
external_job_title,
company_name,
failure_reason
)

VALUES($1,$2,$3,$4)

RETURNING *`,

[
candidate_id,
external_job_title,
company_name,
failure_reason
]

);

res.status(201).json({

message:"Pending application saved",

pending:result.rows[0]

});

}
catch(error){

console.log(error);

res.status(500).json({
error:"Pending save failed"
});

}

};

const getPendingApplications = async(req,res)=>{

try{

const user_id=req.user.user_id;

const candidate=await pool.query(

`SELECT candidate_id
FROM candidates
WHERE user_id=$1`,
[user_id]

);

const candidate_id=
candidate.rows[0].candidate_id;

const result=await pool.query(

`SELECT *
FROM pending_applications
WHERE candidate_id=$1`,

[candidate_id]

);

res.status(200).json({
pendingApplications:
result.rows
});

}
catch(error){

console.log(error);

res.status(500).json({
error:"Unable to fetch pending applications"
});

}

};

module.exports={

createPendingApplication,
getPendingApplications

};