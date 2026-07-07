const pool=require("../config/db");

const {
runJobMatchAgent
}=require("../ai-agents/jobMatchAgent");

const matchJobsV2=async(req,res)=>{

try{

const candidateResult=
await pool.query(

`SELECT candidate_id

FROM candidates

WHERE user_id=$1`,

[req.user.user_id]

);

if(
candidateResult.rows.length===0
){

return res.status(404).json({

error:"Candidate not found"

});

}

const candidate_id=

candidateResult.rows[0]
.candidate_id;

const matchedJobs=

await runJobMatchAgent(
candidate_id
);

matchedJobs.sort(

(a,b)=>
b.match_score-
a.match_score

);

res.status(200).json({

matchedJobs

});

}
catch(error){

console.log(error);

res.status(500).json({

error:"Unable to match jobs"

});

}

};

module.exports={
matchJobsV2
};