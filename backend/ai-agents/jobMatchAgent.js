const pool=require("../config/db");

const runJobMatchAgent=async(candidateId)=>{

try{

const candidateResult=

await pool.query(

`SELECT skills

FROM candidates

WHERE candidate_id=$1`,

[candidateId]

);

if(
candidateResult.rows.length===0
){

return [];

}

const candidateSkills=

candidateResult.rows[0]
.skills
.toLowerCase()
.split(",")
.map(skill=>skill.trim());

const jobs=

await pool.query(

`SELECT * FROM jobs`

);

const matchedJobs=[];

for(const job of jobs.rows){

let score=0;

candidateSkills.forEach(skill=>{

if(

job.required_skills
.toLowerCase()
.includes(skill)

){

score+=20;

}

});

if(score>0){

matchedJobs.push({

job_id:
job.job_id,

job_title:
job.job_title,

company_name:
job.company_name,

match_score:
score

});

}

}

return matchedJobs;

}
catch(error){

console.log(error);

return [];

}

};

module.exports={
runJobMatchAgent
};