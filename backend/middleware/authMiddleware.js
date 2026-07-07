const jwt=require("jsonwebtoken");

const verifyToken=(req,res,next)=>{

try{

const authHeader=

req.headers.authorization;

if(!authHeader){

return res.status(401).json({

error:"Access denied"

});

}

const token=

authHeader.startsWith("Bearer ")

?

authHeader.split(" ")[1]

:

authHeader;

const verified=

jwt.verify(

token,
process.env.JWT_SECRET

);

req.user=verified;

next();

}
catch(error){

console.log(
"JWT ERROR:",
error.message
);

return res.status(401).json({

error:"Invalid token"

});

}

};

module.exports=
verifyToken;