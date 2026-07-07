import axios from "axios";

const API=axios.create({

baseURL:
"http://localhost:5000/api"

});

export const getMyJobs=(token)=>{

return API.get(

"/recruiter/my-jobs",

{

headers:{

Authorization:
`Bearer ${token}`

}

}

);

};


export const getApplicants=(

jobId,
token

)=>{

return API.get(

`/recruiter-ranking/${jobId}`,

{

headers:{

Authorization:
`Bearer ${token}`

}

}

);

};

export const updateStatus=(

data,
token

)=>{

return API.put(

"/application-status/update",

data,

{

headers:{

Authorization:
`Bearer ${token}`

}

}

);

};

export const scheduleInterview=(

data,
token

)=>{

return API.post(

"/interviews/schedule",

data,

{

headers:{

Authorization:
`Bearer ${token}`

}

}

);

};