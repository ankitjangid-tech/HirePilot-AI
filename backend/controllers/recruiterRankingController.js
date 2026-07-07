const pool=require("../config/db");

const rankApplicants=async(req,res)=>{

try{

const {jobId}=req.params;

const result=await pool.query(

`SELECT DISTINCT ON (c.candidate_id)

a.application_id,
c.candidate_id,
u.full_name,
c.skills,
c.experience_years,
c.ats_score,
a.application_status

FROM applications a

JOIN candidates c

ON a.candidate_id=c.candidate_id

JOIN users u

ON c.user_id=u.user_id

WHERE a.job_id=$1`,

[jobId]

);

const rankedCandidates=[];

for(const candidate of result.rows){

let rankingScore=0;

rankingScore+=candidate.ats_score;

rankingScore+=candidate.experience_years*10;

if(
candidate.skills
){

const totalSkills=

candidate.skills
.split(",")
.length;

rankingScore+=
totalSkills*5;

}

rankedCandidates.push({

application_id:
candidate.application_id,

candidate_id:
candidate.candidate_id,

full_name:
candidate.full_name,

skills:
candidate.skills,

experience_years:
candidate.experience_years,

ats_score:
candidate.ats_score,

application_status:
candidate.application_status,

ranking_score:
rankingScore

});

}

rankedCandidates.sort(

(a,b)=>
b.ranking_score-
a.ranking_score

);

res.status(200).json({

rankedCandidates

});

}
catch(error){

console.log(error);

res.status(500).json({

error:
"Unable to rank applicants"

});

}

};

module.exports={
rankApplicants
};