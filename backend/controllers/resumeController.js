const pdfParse=require("pdf-parse");
const fs=require("fs");
const pool=require("../config/db");

const uploadResume=async(req,res)=>{

try{

const dataBuffer=fs.readFileSync(req.file.path);

const pdfData=await pdfParse(dataBuffer);

const resumeText=pdfData.text;

const skills=[];

const skillList=[
"Python",
"SQL",
"React",
"Java",
"JavaScript",
"HTML",
"CSS",
"Node.js",
"Express",
"PostgreSQL"
];

skillList.forEach((skill)=>{

if(
resumeText.toLowerCase()
.includes(skill.toLowerCase())
){

skills.push(skill);

}

});

let experience="Not Found";

const experiencePatterns=[

/(\d+\.?\d*)\s*(year|years)/i,
/(\d+\.?\d*)\s*(month|months)/i,
/experience\s*[:-]?\s*(\d+\.?\d*\s*(year|years|month|months))/i,
/total\s*experience\s*[:-]?\s*(\d+\.?\d*\s*(year|years|month|months))/i

];

for(const pattern of experiencePatterns){

const match=resumeText.match(pattern);

if(match){

experience=match[0];
break;

}

}

let education="Not Found";

if(
resumeText.toLowerCase().includes("mca")
){

education="MCA";

}
else if(
resumeText.toLowerCase().includes("bsc")
){

education="BSc";

}
else if(
resumeText.toLowerCase().includes("b.tech")
){

education="B.Tech";

}

let atsScore=0;

atsScore+=skills.length*10;

if(
education!=="Not Found"
){

atsScore+=20;

}

if(
experience!=="Not Found"
){

atsScore+=30;

}

if(
atsScore>100
){

atsScore=100;

}

const experienceYears=
experience==="Not Found"
?
null
:
parseInt(experience.match(/\d+/)?.[0]);

const updateResult=await pool.query(

`UPDATE candidates
SET

skills=COALESCE(NULLIF($1,''),skills),
experience_years=COALESCE($2,experience_years),
resume_url=$3,
ats_score=$4

WHERE user_id=$5

RETURNING *`,

[
skills.join(","),
experienceYears,
req.file.filename,
atsScore,
req.user.user_id
]

);

console.log("UPDATED DATA:");
console.log(updateResult.rows);

const parsedData={

skills,
experience,
education,
ats_score:atsScore

};

res.status(200).json({

message:"Resume uploaded successfully",

file:req.file.filename,

parsedData

});

}
catch(error){

console.log(error);

res.status(500).json({

error:"Upload failed"

});

}

};

module.exports={uploadResume};
