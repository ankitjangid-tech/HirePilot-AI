const pool = require("../config/db");

const matchJobs = async(req,res)=>{

try{

const user_id=req.user.user_id;

const candidate=await pool.query(

`SELECT * FROM candidates
WHERE user_id=$1`,
[user_id]

);

const candidateData=candidate.rows[0];

const jobs=await pool.query(
`SELECT * FROM jobs`
);

const matchedJobs=[];

jobs.rows.forEach(job=>{

const candidateSkills =
candidateData.skills
.toLowerCase()
.split(",")
.map(skill=>skill.trim());

const requiredSkills =
job.required_skills
.toLowerCase()
.split(",")
.map(skill=>skill.trim());

const matched=
candidateSkills.filter(skill=>
requiredSkills.includes(skill)
);

const score=
(Math.round(
(matched.length/
requiredSkills.length)
*100
));

matchedJobs.push({

job_id:job.job_id,
job_title:job.job_title,
company_name:job.company_name,
match_score:score

});

});

res.status(200).json({
matchedJobs
});

}
catch(error){

console.log(error);

res.status(500).json({
error:"Matching failed"
});

}

};

module.exports={matchJobs};