const pool=require("../config/db");

const applyExternalJob=async(req,res)=>{

try{

const {

candidate_id,
job_title,
company_name,
job_url

}=req.body;

/*
V1 logic:

If URL contains "questions"
→ move to pending applications

Otherwise
→ successful application

Later:
Playwright/Puppeteer
will replace this
*/

const requiresManualCompletion=

job_url
.toLowerCase()
.includes("questions");

if(!requiresManualCompletion){

return res.status(200).json({

message:
"External application completed",

job_title,
company_name

});

}

await pool.query(

`INSERT INTO pending_applications(

candidate_id,
external_job_title,
company_name,
failure_reason

)

VALUES($1,$2,$3,$4)`,

[

candidate_id,
job_title,
company_name,
"Additional questions required on external portal"

]

);

res.status(200).json({

message:
"Moved to pending applications",

job_title,
company_name

});

}
catch(error){

console.log(error);

res.status(500).json({

error:
"External application failed"

});

}

};

module.exports={
applyExternalJob
};