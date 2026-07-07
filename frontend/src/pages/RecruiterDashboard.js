import { useEffect, useMemo, useState } from "react";
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

const formatDate = (value) => {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString();
};

const splitSkills = (skills) => {
  if (!skills) {
    return [];
  }

  return String(skills)
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
};

function RecruiterDashboard() {
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [currentJobTitle, setCurrentJobTitle] = useState("");
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [busyApplicationId, setBusyApplicationId] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [expandedApplicationId, setExpandedApplicationId] = useState(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const selectedCandidateFromList = useMemo(() => {
    if (!selectedCandidate) {
      return null;
    }

    return (
      applicants.find(
        (candidate) =>
          candidate.application_id === selectedCandidate.application_id
      ) || selectedCandidate
    );
  }, [applicants, selectedCandidate]);

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
      setSelectedCandidate(null);
      setExpandedApplicationId(null);

      const response = await getApplicants(jobId, token);

      setApplicants(
        response.data.rankedCandidates || response.data.applicants || []
      );
    } catch (error) {
      console.log("FETCH APPLICANTS ERROR:", error.response?.data || error.message);
      setApplicants([]);
      setActionMessage(error.response?.data?.error || "Unable to fetch applicants");
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
                has_interview: true,
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
                  has_interview: true,
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

  const toggleDetails = (candidate) => {
    setExpandedApplicationId((currentId) =>
      currentId === candidate.application_id ? null : candidate.application_id
    );
  };

  const renderCandidateDetails = (candidate) => (
    <div className="candidate-preview-box">
      <div className="preview-grid">
        <div>
          <span>Preferred Role</span>
          <strong>{candidate.preferred_role || "Not added"}</strong>
        </div>
        <div>
          <span>Preferred Location</span>
          <strong>{candidate.preferred_location || "Not added"}</strong>
        </div>
        <div>
          <span>Expected Salary</span>
          <strong>{candidate.expected_salary || "Not added"}</strong>
        </div>
        <div>
          <span>Applied At</span>
          <strong>{formatDate(candidate.applied_at)}</strong>
        </div>
      </div>

      <div className="preview-section">
        <p className="preview-label">Candidate Skills</p>
        <div className="chip-row">
          {splitSkills(candidate.skills).length === 0 ? (
            <span className="chip">No skills added</span>
          ) : (
            splitSkills(candidate.skills).map((skill) => (
              <span className="chip" key={skill}>
                {skill}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="preview-section">
        <p className="preview-label">Job Skill Match</p>
        <div className="chip-row">
          {(candidate.matched_skills || []).length === 0 ? (
            <span className="chip warning">No matched skills calculated</span>
          ) : (
            candidate.matched_skills.map((skill) => (
              <span className="chip success" key={skill}>
                {skill}
              </span>
            ))
          )}
        </div>
      </div>

      {(candidate.missing_skills || []).length > 0 && (
        <div className="preview-section">
          <p className="preview-label">Missing Job Skills</p>
          <div className="chip-row">
            {candidate.missing_skills.map((skill) => (
              <span className="chip warning" key={skill}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="score-breakdown-grid">
        <div>
          <span>ATS Contribution</span>
          <strong>{candidate.score_breakdown?.ats_score ?? "N/A"}</strong>
        </div>
        <div>
          <span>Skill Match</span>
          <strong>{candidate.score_breakdown?.skill_match_score ?? "N/A"}</strong>
        </div>
        <div>
          <span>Experience</span>
          <strong>{candidate.score_breakdown?.experience_score ?? "N/A"}</strong>
        </div>
      </div>

      <div className="preview-footer">
        <span>
          Resume: {candidate.resume_url ? candidate.resume_url : "Not uploaded"}
        </span>
        {candidate.has_interview && (
          <span>Interview already scheduled</span>
        )}
      </div>
    </div>
  );

  return (
    <main className="dashboard-shell">
      <section className="dashboard-hero recruiter-hero">
        <div>
          <p className="eyebrow">Recruiter Portal</p>
          <h1>Recruiter Dashboard</h1>
          <p className="muted">
            Review applicants, inspect candidate profiles, update status, and schedule interviews.
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
            {applicants.map((candidate, index) => {
              const isExpanded = expandedApplicationId === candidate.application_id;

              return (
                <article
                  className="applicant-card"
                  key={candidate.application_id || candidate.candidate_id || index}
                >
                  <div className="applicant-main">
                    <div>
                      <h3>{candidate.full_name || "Candidate"}</h3>
                      <p>{candidate.preferred_role || "Preferred role not added"}</p>
                    </div>
                    <span className={statusClass(candidate.application_status)}>
                      {candidate.application_status}
                    </span>
                  </div>

                  <div className="metric-row recruiter-metrics">
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
                    <div>
                      <span>Location</span>
                      <strong>{candidate.preferred_location || "N/A"}</strong>
                    </div>
                  </div>

                  {isExpanded && renderCandidateDetails(candidate)}

                  <div className="button-row">
                    <button
                      className="secondary-button"
                      onClick={() => toggleDetails(candidate)}
                    >
                      {isExpanded ? "Hide Profile" : "View Profile"}
                    </button>

                    <button
                      className="secondary-button"
                      onClick={() => setSelectedCandidate(candidate)}
                    >
                      Preview Panel
                    </button>

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
                        candidate.has_interview ||
                        busyApplicationId === candidate.application_id
                      }
                      onClick={() =>
                        handleInterview(
                          candidate.application_id,
                          candidate.candidate_id
                        )
                      }
                    >
                      {candidate.has_interview
                        ? "Interview Scheduled"
                        : "Schedule Interview"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedCandidateFromList && (
        <div className="preview-overlay" onClick={() => setSelectedCandidate(null)}>
          <aside
            className="preview-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="preview-drawer-header">
              <div>
                <p className="eyebrow">Candidate Preview</p>
                <h2>{selectedCandidateFromList.full_name || "Candidate"}</h2>
              </div>
              <button
                className="secondary-button small-button"
                onClick={() => setSelectedCandidate(null)}
              >
                Close
              </button>
            </div>

            <span className={statusClass(selectedCandidateFromList.application_status)}>
              {selectedCandidateFromList.application_status}
            </span>

            {renderCandidateDetails(selectedCandidateFromList)}
          </aside>
        </div>
      )}
    </main>
  );
}

export default RecruiterDashboard;
