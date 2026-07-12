const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const bcrypt = require("bcryptjs");

const crypto=require("crypto");

const {sendEmail}=

require("../services/emailService");

const registerUser = async (req, res) => {

    try {

        const {
            full_name,
            email,
            password,
            role
        } = req.body;

        const normalizedRole = String(role || "").toLowerCase();

        if(!["candidate", "recruiter"].includes(normalizedRole)){
            return res.status(400).json({
                error:"Role must be candidate or recruiter"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users
            (full_name,email,password_hash,role,recruiter_status,recruiter_status_updated_at)
            
            VALUES($1,$2,$3,$4,$5,$6)
            
            RETURNING
            user_id,
            full_name,
            email,
            role,
            recruiter_status,
            recruiter_status_updated_at,
            created_at`,
            [
                full_name,
                email,
                hashedPassword,
                normalizedRole,
                normalizedRole === "recruiter" ? "pending" : null,
                normalizedRole === "recruiter" ? new Date() : null
            ]
        );

        res.status(201).json({
            message:"User Registered Successfully",
            user: result.rows[0]
        });

    } catch(error){

        console.log(error);

        res.status(500).json({
            error:"Registration failed"
        });

    }

};

const loginUser = async (req, res) => {

    try {

        const { email, password } = req.body;

        const result = await pool.query(
            "SELECT * FROM users WHERE email=$1",
            [email]
        );

        if(result.rows.length===0){

            return res.status(404).json({
                error:"User not found"
            });

        }

        const user = result.rows[0];

        const validPassword =
        await bcrypt.compare(
            password,
            user.password_hash
        );

        if(!validPassword){

            return res.status(401).json({
                error:"Invalid password"
            });

        }

        const token =
        jwt.sign(
            {
                user_id:user.user_id,
                role:user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn:"1d"
            }
        );

        res.json({

            message:
            "Login Successful",

            token,

            role:

            user.role,

            recruiter_status:
            user.role === "recruiter"
            ? user.recruiter_status || "pending"
            : null,

            recruiter_status_reason:
            user.role === "recruiter"
            ? user.recruiter_status_reason || null
            : null

        });

    } catch(error){

        console.log(error);

        res.status(500).json({
            error:"Login failed"
        });

    }

};

const forgotPassword=

async(req,res)=>{

try{

const {email}=req.body;

const userResult=

await pool.query(

`SELECT *
FROM users
WHERE email=$1`,

[email]

);

if(

userResult.rows.length===0

){

return res.status(404).json({

error:"User not found"

});

}

const user=

userResult.rows[0];

const resetToken=

crypto.randomBytes(32)
.toString("hex");

const expiry=

new Date(

Date.now()+3600000

);

await pool.query(

`UPDATE users

SET

reset_token=$1,

reset_token_expiry=$2

WHERE user_id=$3`,

[

resetToken,
expiry,
user.user_id

]

);

const resetLink=

`http://localhost:3000/reset-password/${resetToken}`;

await sendEmail(

user.email,

"Reset Password",

`<h2>HirePilot AI</h2>

<p>Click below:</p>

<a href="${resetLink}">

Reset Password

</a>`

);

res.status(200).json({

message:

"Password reset email sent"

});

}
catch(error){

console.log(error);

res.status(500).json({

error:"Failed to send email"

});

}

};

const resetPassword=

async(req,res)=>{

try{

const {

token,
newPassword

}=req.body;

const userResult=

await pool.query(

`SELECT *

FROM users

WHERE

reset_token=$1

AND

reset_token_expiry > NOW()`,

[token]

);

if(

userResult.rows.length===0

){

return res.status(400).json({

error:"Invalid or expired token"

});

}

const user=

userResult.rows[0];

const bcrypt=

require("bcrypt");

const hashedPassword=

await bcrypt.hash(

newPassword,
10

);

await pool.query(

`UPDATE users

SET

password_hash=$1,
reset_token=NULL,
reset_token_expiry=NULL

WHERE user_id=$2`,

[
hashedPassword,
user.user_id
]

);

res.status(200).json({

message:

"Password reset successful"

});

}
catch(error){

console.log(error);

res.status(500).json({

error:"Password reset failed"

});

}

};

module.exports={

registerUser,
loginUser,
forgotPassword,
resetPassword

};
