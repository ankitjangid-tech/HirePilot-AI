const pool = require("../config/db");

const autoApply = async(req,res)=>{

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

const {job_id}=req.body;

/* Check duplicate application */

const existingApplication=
await pool.query(

`SELECT *
FROM applications
WHERE candidate_id=$1
AND job_id=$2`,

[
candidate_id,
job_id
]

);

if(

existingApplication.rows.length>0

){

return res.status(400).json({

message:"Already Applied"

});

}

/* Insert only if application does not exist */

const result=await pool.query(

`INSERT INTO applications
(
candidate_id,
job_id,
application_status
)

VALUES($1,$2,$3)

RETURNING *`,

[
candidate_id,
job_id,
"Applied"
]

);

res.status(201).json({

message:"Application submitted",

application:result.rows[0]

});

}
catch(error){

console.log(error);

res.status(500).json({

error:"Application failed"

});

}

};

const getMyApplications = async(req,res)=>{

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

`SELECT

a.application_id,
a.application_status,
a.applied_at,

j.job_title,
j.company_name

FROM applications a

JOIN jobs j
ON a.job_id=j.job_id

WHERE a.candidate_id=$1`,

[candidate_id]

);

res.status(200).json({

applications:result.rows

});

}
catch(error){

console.log(error);

res.status(500).json({

error:"Unable to fetch applications"

});

}

};

module.exports={

autoApply,
getMyApplications

};