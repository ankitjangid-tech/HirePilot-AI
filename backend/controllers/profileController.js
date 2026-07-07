const pool=require("../config/db");

const requiredProfileFields=[
"skills",
"experience_years",
"preferred_role",
"preferred_location",
"expected_salary"
];

const isMissingField=(field,value)=>{

if(value===null || value===undefined){

return true;

}

if(typeof value==="string" && value.trim()===""){

return true;

}

if(field==="expected_salary" && Number(value)<=0){

return true;

}

if(field==="experience_years" && Number(value)<0){

return true;

}

return false;

};

const getProfileStatus=async(req,res)=>{

try{

const result=await pool.query(

`SELECT

skills,
experience_years,
preferred_role,
preferred_location,
expected_salary,
ats_score

FROM candidates
WHERE user_id=$1`,

[req.user.user_id]

);

if(result.rows.length===0){

return res.status(404).json({

error:"Candidate profile not found"

});

}

const profile=result.rows[0];

const missingFields=

requiredProfileFields.filter((field)=>

isMissingField(
field,
profile[field]
)

);

const completedFields=

requiredProfileFields.filter((field)=>

!missingFields.includes(field)

);

res.status(200).json({

profile,
profile_completed:
missingFields.length===0,

missing_fields:
missingFields,

completed_fields:
completedFields,

required_fields:
requiredProfileFields

});

}
catch(error){

console.log(error);

res.status(500).json({

error:"Unable to fetch profile"

});

}

};

module.exports={
getProfileStatus
};
