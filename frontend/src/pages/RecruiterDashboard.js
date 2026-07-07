import { useEffect, useState } from "react";
import "../App.css";

import {
  getMyJobs,
  getApplicants,
  updateStatus,
  scheduleInterview,
} from "../services/recruiterService";

const statusClass = (status) =>
  `status-badge status-${String(status || "default")
    .toLowerCase()
    .replace(/\s+/g, "-")}`;

function RecruiterDashboard() {
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [currentJobTitle, setCurrentJobTitle] = useState("");
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [busyApplicationId, setBusyApplicationId] = useState(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const token = localStorage.getItem("token");

      setLoadingJobs(true);
      const response = await getMyJobs(token);

      setJobs(response.data.jobs || []);
    } catch (error) {
      console.log("FETCH JOBS ERROR:", error.response?.data || error.message);
      setActionMessage("Unable to fetch recruiter jobs");
    } finally {
      setLoadingJobs(false);
    }
  };

  const fetchApplicants = async (jobId, jobTitle) => {
    try {
      const token = localStorage.getItem("token");

      setCurrentJobId(jobId);
      setCurrentJobTitle(jobTitle);
      setLoadingApplicants(true);
      setActionMessage("");

      const response = await getApplicants(jobId, token);

      setApplicants(
        response.data.rankedCandidates || response.data.applicants || []
      );
    } catch (error) {
      console.log("FETCH APPLICANTS ERROR:", error.response?.data || error.message);
      setApplicants([]);
      setActionMessage("Unable to fetch applicants");
    } finally {
      setLoadingApplicants(false);
    }
  };

  const handleStatus = async (applicationId, status) => {
    try {
      const token = localStorage.getItem("token");

      setBusyApplicationId(applicationId);
      setActionMessage("");

      const response = await updateStatus(
        {
          application_id: applicationId,
          application_status: status,
        },
        token
      );

      setApplicants((previousApplicants) =>
        previousApplicants.map((candidate) =>
          candidate.application_id === applicationId
            ? {
                ...candidate,
                application_status: response.data.application.application_status,
              }
            : candidate
        )
      );

      setActionMessage(response.data.message || "Status updated");
    } catch (error) {
      console.log("STATUS UPDATE ERROR:", error.response?.data || error.message);
      setActionMessage(error.response?.data?.error || "Status update failed");
    } finally {
      setBusyApplicationId(null);
    }
  };

  const handleInterview = async (applicationId, candidateId) => {
    try {
      const token = localStorage.getItem("token");

      setBusyApplicationId(applicationId);
      setActionMessage("");

      const response = await scheduleInterview(
        {
          application_id: applicationId,
          candidate_id: candidateId,
          job_id: currentJobId,
          interview_date: "2026-07-10",
          interview_time: "10:30:00",
        },
        token
      );

      setApplicants((previousApplicants) =>
        previousApplicants.map((candidate) =>
          candidate.application_id === applicationId
            ? {
                ...candidate,
                application_status: "Interview Scheduled",
              }
            : candidate
        )
      );

      setActionMessage(response.data.message || "Interview scheduled");
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Interview scheduling failed";

      console.log("INTERVIEW ERROR:", error.response?.data || error.message);

      if (errorMessage.includes("already scheduled")) {
        setApplicants((previousApplicants) =>
          previousApplicants.map((candidate) =>
            candidate.application_id === applicationId
              ? {
                  ...candidate,
                  application_status: "Interview Scheduled",
                }
              : candidate
          )
        );
      }

      setActionMessage(errorMessage);
    } finally {
      setBusyApplicationId(null);
    }
  };

  return (
    <main className="dashboard-shell">
      <section className="dashboard-hero recruiter-hero">
        <div>
          <p className="eyebrow">Recruiter Portal</p>
          <h1>Recruiter Dashboard</h1>
          <p className="muted">
            Review applicants, rank candidates, update status, and schedule interviews.
          </p>
        </div>
        <div className="hero-metric">
          <span>Total Jobs</span>
          <strong>{jobs.length}</strong>
        </div>
      </section>

      {actionMessage && <div className="notice-banner">{actionMessage}</div>}

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Jobs</p>
            <h2>My Job Posts</h2>
          </div>
          <span className="count-pill">{jobs.length}</span>
        </div>

        {loadingJobs ? (
          <p className="empty-state">Loading jobs...</p>
        ) : jobs.length === 0 ? (
          <p className="empty-state">No jobs posted yet.</p>
        ) : (
          <div className="card-grid">
            {jobs.map((job) => (
              <article
                className={
                  currentJobId === job.job_id ? "item-card selected" : "item-card"
                }
                key={job.job_id}
              >
                <div>
                  <h3>{job.job_title}</h3>
                  <p>{job.company_name}</p>
                  <div className="chip-row">
                    <span className="chip">{job.required_skills}</span>
                    <span className="chip">{job.salary}</span>
                  </div>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => fetchApplicants(job.job_id, job.job_title)}
                >
                  View Applicants
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Applicants</p>
            <h2>{currentJobTitle || "Select a job"}</h2>
          </div>
          <span className="count-pill">{applicants.length}</span>
        </div>

        {loadingApplicants ? (
          <p className="empty-state">Loading applicants...</p>
        ) : !currentJobId ? (
          <p className="empty-state">Choose a job to review applicants.</p>
        ) : applicants.length === 0 ? (
          <p className="empty-state">No applicants found for this job.</p>
        ) : (
          <div className="applicant-list">
            {applicants.map((candidate, index) => (
              <article
                className="applicant-card"
                key={candidate.application_id || candidate.candidate_id || index}
              >
                <div className="applicant-main">
                  <div>
                    <h3>{candidate.full_name || "Candidate"}</h3>
                    <p>{candidate.skills || "Skills not available"}</p>
                  </div>
                  <span className={statusClass(candidate.application_status)}>
                    {candidate.application_status}
                  </span>
                </div>

                <div className="metric-row">
                  <div>
                    <span>Experience</span>
                    <strong>{candidate.experience_years ?? 0} years</strong>
                  </div>
                  <div>
                    <span>ATS Score</span>
                    <strong>{candidate.ats_score ?? "N/A"}</strong>
                  </div>
                  <div>
                    <span>Ranking Score</span>
                    <strong>{candidate.ranking_score ?? "N/A"}</strong>
                  </div>
                </div>

                <div className="button-row">
                  <button
                    className="primary-button"
                    disabled={
                      candidate.application_status === "Shortlisted" ||
                      candidate.application_status === "Interview Scheduled" ||
                      busyApplicationId === candidate.application_id
                    }
                    onClick={() =>
                      handleStatus(candidate.application_id, "Shortlisted")
                    }
                  >
                    Shortlist
                  </button>

                  <button
                    className="danger-button"
                    disabled={
                      candidate.application_status === "Rejected" ||
                      busyApplicationId === candidate.application_id
                    }
                    onClick={() =>
                      handleStatus(candidate.application_id, "Rejected")
                    }
                  >
                    Reject
                  </button>

                  <button
                    className="secondary-button"
                    disabled={
                      candidate.application_status === "Interview Scheduled" ||
                      candidate.application_status === "Rejected" ||
                      busyApplicationId === candidate.application_id
                    }
                    onClick={() =>
                      handleInterview(
                        candidate.application_id,
                        candidate.candidate_id
                      )
                    }
                  >
                    Schedule Interview
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default RecruiterDashboard;
