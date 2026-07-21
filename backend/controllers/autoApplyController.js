const pool=require("../config/db");
const { calculateFixedSkillScore } = require("../services/matchingService");

const isProfileIncomplete=(candidate)=>{

return (
!candidate.skills ||
candidate.experience_years===null ||
candidate.experience_years===undefined ||
Number(candidate.experience_years)<0 ||
!candidate.preferred_role ||
!candidate.preferred_location ||
!candidate.expected_salary
);

};

const autoApply=async(req,res)=>{

try{

const userId=req.user.user_id;

const candidateResult=
await pool.query(

`SELECT
candidate_id,
skills,
experience_years,
preferred_role,
preferred_location,
expected_salary

FROM candidates

WHERE user_id=$1`,

[userId]

);

if(candidateResult.rows.length===0){

return res.status(404).json({

error:"Candidate profile not found"

});

}

const candidate=
candidateResult.rows[0];

if(isProfileIncomplete(candidate)){

return res.status(400).json({

error:"Please complete your profile before using Auto Apply"

});

}

const candidateDBId=
candidate.candidate_id;

const jobsResult=
await pool.query(

`SELECT
job_id,
job_title,
company_name,
required_skills

FROM jobs`

);

const appliedJobs=[];
const pendingJobs=[];
const skippedJobs=[];

for(const job of jobsResult.rows){

const matchScore=
calculateFixedSkillScore(
candidate.skills,
job.required_skills
).matchScore;

if(matchScore<40){

skippedJobs.push({

job_id:job.job_id,
job_title:job.job_title,
reason:"Low match score",
match_score:matchScore

});

continue;

}

const existingApplication=
await pool.query(

`SELECT
application_id,
application_status

FROM applications

WHERE candidate_id=$1
AND job_id=$2`,

[
candidateDBId,
job.job_id
]

);

if(existingApplication.rows.length>0){

skippedJobs.push({

job_id:job.job_id,
job_title:job.job_title,
reason:"Already applied or pending",
application_status:
existingApplication.rows[0].application_status,
match_score:matchScore

});

continue;

}

const applicationStatus=
matchScore>=60
?
"Applied"
:
"Pending";

const application=
await pool.query(

`INSERT INTO applications(
candidate_id,
job_id,
application_status
)

VALUES($1,$2,$3)

RETURNING *`,

[
candidateDBId,
job.job_id,
applicationStatus
]

);

const applicationData={

...application.rows[0],
job_title:job.job_title,
company_name:job.company_name,
match_score:matchScore

};

if(applicationStatus==="Applied"){

appliedJobs.push(applicationData);

}
else{

pendingJobs.push({

...applicationData,
reason:"Manual review required for medium match score"

});

}

}

res.status(200).json({

message:"Auto Apply Completed",
successful_applications:
appliedJobs.length,
pending_applications:
pendingJobs.length,
skipped_applications:
skippedJobs.length,
appliedJobs,
pendingJobs,
skippedJobs

});

}
catch(error){

console.log(error);

res.status(500).json({

error:"Auto Apply Failed"

});

}

};

module.exports={
autoApply
};
