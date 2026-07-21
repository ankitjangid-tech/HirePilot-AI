require("dotenv").config();

const adminRoutes = require("./routes/adminRoutes");

const externalJobRoutes=
require("./routes/externalJobRoutes");
const notificationRoutes=
require("./routes/notificationRoutes");
const recruiterRankingRoutes=
require("./routes/recruiterRankingRoutes");
const pendingApplicationRoutes=
require("./routes/pendingApplicationRoutes");
const autoApplyRoutes=
require("./routes/autoApplyRoutes");
const aiMatchV2Routes=require("./routes/aiMatchV2Routes");
const profileUpdateRoutes=require("./routes/profileUpdateRoutes");
const profileRoutes=require("./routes/profileRoutes");
const myJobsRoutes=
require("./routes/myJobsRoutes");
const jobListRoutes=
require("./routes/jobListRoutes");
const applicationStatusRoutes=
require("./routes/applicationStatusRoutes");
const recruiterRoutes=
require("./routes/recruiterRoutes");
const interviewRoutes =
require("./routes/interviewRoutes");
const pendingRoutes =
require("./routes/pendingRoutes");
const applyRoutes =
require("./routes/applyRoutes");
const aiRoutes = require("./routes/aiRoutes");
const jobRoutes =
require("./routes/jobRoutes");
const resumeRoutes = require("./routes/resumeRoutes");
const candidateRoutes =
require("./routes/candidateRoutes");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/db");

const app = express();
const authRoutes = require("./routes/authRoutes");

app.use(cors());
app.use(express.json());
app.use("/api/auth",authRoutes);
app.use("/api/admin",adminRoutes);
app.use("/api/candidate",candidateRoutes);
app.use("/api/resume",resumeRoutes);
app.use("/api/jobs",jobRoutes);
app.use("/api/ai", aiRoutes);
app.use(
"/api/applications",
applyRoutes
);
app.use(
"/api/pending",
pendingRoutes
);
app.use(
"/api/interviews",
interviewRoutes
);
app.use(
"/api/recruiter",
recruiterRoutes
);
app.use(
"/api/application-status",
applicationStatusRoutes
);
app.use(
"/api/jobs",
jobListRoutes
);
app.use(
"/api/recruiter",
myJobsRoutes
);
app.use("/api/profile",profileRoutes);
app.use("/api/profile",profileUpdateRoutes);
app.use("/api/ai",aiMatchV2Routes);
app.use(
"/api/auto-apply",
autoApplyRoutes
);
app.use(
"/api/pending-applications",
pendingApplicationRoutes
);
app.use(
"/api/recruiter-ranking",
recruiterRankingRoutes
);
app.use(
"/api/notifications",
notificationRoutes
);
app.use(
"/api/external-jobs",
externalJobRoutes
);

app.get("/", async (req, res) => {

    try {

        const result = await pool.query(
            "SELECT NOW()"
        );

        res.json({
            message: "HirePilot Backend Running",
            databaseTime: result.rows[0]
        });

    } catch(error){

        console.log(error);

        res.status(500).json({
            error:"Database connection failed"
        });

    }

});

const PORT = Number(process.env.PORT || 5000);

app.listen(PORT, ()=>{
    console.log(`Server running on port ${PORT}`);
});
