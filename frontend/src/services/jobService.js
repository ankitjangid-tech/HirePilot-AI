import axios from "axios";

const API=axios.create({

baseURL:
"http://localhost:5000/api"

});

export const getMatchedJobs=(token)=>{

return API.get(

"/ai/match-v2",

{

headers:{

Authorization:
`Bearer ${token}`

}

}

);

};

export const autoApply=(token)=>{

return API.post(

"/auto-apply/apply",

{},

{

headers:{

Authorization:
`Bearer ${token}`

}

}

);

};