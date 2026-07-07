const pool=require("../config/db");

const getNotifications=async(req,res)=>{

try{

const candidateResult=

await pool.query(

`SELECT candidate_id
FROM candidates
WHERE user_id=$1`,

[req.user.user_id]

);

const candidateId=

candidateResult.rows[0]
.candidate_id;

const notificationResult=

await pool.query(

`SELECT

notification_id,
message,
created_at

FROM notifications

WHERE candidate_id=$1

ORDER BY created_at DESC`,

[candidateId]

);

const interviewResult=

await pool.query(

`SELECT

interview_id,
interview_date,
interview_time,
meeting_link

FROM interviews

WHERE candidate_id=$1
AND COALESCE(status,'Scheduled')<>'Cancelled'

ORDER BY interview_date ASC`,

[candidateId]

);

const notifications=[

...notificationResult.rows,

...interviewResult.rows

];

res.status(200).json({

notifications

});

}
catch(error){

console.log(error);

res.status(500).json({

error:"Unable to fetch notifications"

});

}

};

module.exports={

getNotifications

};
