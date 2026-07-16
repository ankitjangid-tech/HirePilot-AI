import { useEffect, useMemo, useState } from "react";
import "../App.css";

import {
  getMyJobs,
  getCompanyProfile,
  saveCompanyProfile,
  getApplicants,
  updateStatus,
  scheduleInterview,
  rescheduleInterview,
  cancelInterview,
  viewApplicantResume,
  downloadApplicantResume,
} from "../services/recruiterService";

const emptyCompanyForm = {
  company_name: "",
  company_website: "",
  industry: "",
  company_size: "",
  headquarters_location: "",
  company_description: "",
};

const statusClass = (status) =>
  `status-badge status-${String(status || "default")
    .toLowerCase()
    .replace(/[\s_]+/g, "-")}`;

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

const displayValue = (value) => value || "Not added";

const toDateInputValue = (value) => {
  if (!value) {
    return "2026-07-10";
  }

  return new Date(value).toISOString().slice(0, 10);
};

const toTimeInputValue = (value) => {
  if (!value) {
    return "10:30";
  }

  return String(value).slice(0, 5);
};

const formatInterviewDate = (value) => {
  if (!value) {
    return "Not scheduled";
  }

  return new Date(value).toLocaleDateString();
};

const renderExternalLink = (label, url) => {
  if (!url) {
    return null;
  }

  const safeUrl = String(url).startsWith("http") ? url : `https://${url}`;

  return (
    <a href={safeUrl} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
};

const openPdfBlob = (blob) => {
  const pdfBlob = new Blob([blob], { type: "application/pdf" });
  const fileUrl = URL.createObjectURL(pdfBlob);

  window.open(fileUrl, "_blank", "noopener,noreferrer");

  setTimeout(() => {
    URL.revokeObjectURL(fileUrl);
  }, 60000);
};

const downloadPdfBlob = (blob, filename) => {
  const pdfBlob = new Blob([blob], { type: "application/pdf" });
  const fileUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");

  link.href = fileUrl;
  link.download = filename || "applicant-resume.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(fileUrl);
  }, 60000);
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
  const [busyResumeApplicationId, setBusyResumeApplicationId] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [expandedApplicationId, setExpandedApplicationId] = useState(null);
  const [interviewForms, setInterviewForms] = useState({});
  const [recruiterApproval, setRecruiterApproval] = useState({
    status: localStorage.getItem("recruiter_status") || null,
    reason: localStorage.getItem("recruiter_status_reason") || "",
  });
  const [companyProfile, setCompanyProfile] = useState(null);
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyMessage, setCompanyMessage] = useState("");
  const [companyError, setCompanyError] = useState("");

  useEffect(() => {
    fetchJobs();
    fetchCompany();
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
      const recruiterStatus = response.data.recruiter_status || "pending";
      const recruiterStatusReason = response.data.recruiter_status_reason || "";

      setRecruiterApproval({
        status: recruiterStatus,
        reason: recruiterStatusReason,
      });
      localStorage.setItem("recruiter_status", recruiterStatus);
      localStorage.setItem("recruiter_status_reason", recruiterStatusReason);
    } catch (error) {
      console.log("FETCH JOBS ERROR:", error.response?.data || error.message);
      setActionMessage("Unable to fetch recruiter jobs");
    } finally {
      setLoadingJobs(false);
    }
  };

  const fetchCompany = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setCompanyError("Please sign in again to view your company profile.");
        return;
      }

      setCompanyLoading(true);
      const response = await getCompanyProfile(token);
      const company = response.data.company || null;

      setCompanyProfile(company);
      setCompanyForm(
        company
          ? {
              company_name: company.company_name || "",
              company_website: company.company_website || "",
              industry: company.industry || "",
              company_size: company.company_size || "",
              headquarters_location: company.headquarters_location || "",
              company_description: company.company_description || "",
            }
          : emptyCompanyForm
      );
      setCompanyError("");
    } catch (error) {
      console.log(
        "RECRUITER COMPANY FETCH ERROR:",
        error.response?.data || error.message
      );
      setCompanyError(
        error.response?.data?.error || "Unable to fetch company profile"
      );
    } finally {
      setCompanyLoading(false);
    }
  };

  const handleCompanyInputChange = (event) => {
    const { name, value } = event.target;

    setCompanyForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const handleSaveCompanyProfile = async (event) => {
    event.preventDefault();

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setCompanyError("Please sign in again to save your company profile.");
        return;
      }

      setCompanySaving(true);
      setCompanyMessage("");
      setCompanyError("");

      const response = await saveCompanyProfile(companyForm, token);

      setCompanyProfile(response.data.company);
      setCompanyMessage(response.data.message || "Company profile saved.");
    } catch (error) {
      console.log(
        "RECRUITER COMPANY SAVE ERROR:",
        error.response?.data || error.message
      );
      setCompanyError(
        error.response?.data?.error || "Unable to save company profile"
      );
    } finally {
      setCompanySaving(false);
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
      const applicantRows =
        response.data.rankedCandidates || response.data.applicants || [];

      setApplicants(applicantRows);
      setInterviewForms(
        applicantRows.reduce((formMap, candidate) => {
          formMap[candidate.application_id] = {
            interview_date: toDateInputValue(candidate.interview_date),
            interview_time: toTimeInputValue(candidate.interview_time),
          };

          return formMap;
        }, {})
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
                contact_visible:
                  response.data.application.application_status === "Shortlisted" ||
                  response.data.application.application_status ===
                    "Interview Scheduled" ||
                  response.data.application.application_status === "Selected" ||
                  candidate.contact_visible,
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

  const handleInterviewInputChange = (applicationId, field, value) => {
    setInterviewForms((currentForms) => ({
      ...currentForms,
      [applicationId]: {
        ...(currentForms[applicationId] || {}),
        [field]: value,
      },
    }));
  };

  const getInterviewForm = (candidate) =>
    interviewForms[candidate.application_id] || {
      interview_date: toDateInputValue(candidate.interview_date),
      interview_time: toTimeInputValue(candidate.interview_time),
    };

  const updateCandidateInterviewState = (applicationId, interview, applicationStatus) => {
    setApplicants((previousApplicants) =>
      previousApplicants.map((candidate) =>
        candidate.application_id === applicationId
          ? {
              ...candidate,
              application_status: applicationStatus || "Interview Scheduled",
              has_interview: true,
              interview_scheduled: true,
              interview_id: interview.interview_id,
              interview_date: interview.interview_date,
              interview_time: interview.interview_time,
              meeting_link: interview.meeting_link,
              interview_status: interview.status,
              contact_visible: true,
            }
          : candidate
      )
    );

    setInterviewForms((currentForms) => ({
      ...currentForms,
      [applicationId]: {
        interview_date: toDateInputValue(interview.interview_date),
        interview_time: toTimeInputValue(interview.interview_time),
      },
    }));
  };

  const handleInterview = async (candidate) => {
    try {
      const token = localStorage.getItem("token");
      const interviewForm = getInterviewForm(candidate);

      setBusyApplicationId(candidate.application_id);
      setActionMessage("");

      const response = await scheduleInterview(
        {
          application_id: candidate.application_id,
          interview_date: interviewForm.interview_date,
          interview_time: interviewForm.interview_time,
        },
        token
      );

      updateCandidateInterviewState(
        candidate.application_id,
        response.data.interview,
        "Interview Scheduled"
      );

      setActionMessage(response.data.message || "Interview scheduled");
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Interview scheduling failed";

      console.log("INTERVIEW ERROR:", error.response?.data || error.message);

      if (error.response?.data?.interview) {
        updateCandidateInterviewState(
          candidate.application_id,
          error.response.data.interview,
          "Interview Scheduled"
        );
      }

      setActionMessage(errorMessage);
    } finally {
      setBusyApplicationId(null);
    }
  };

  const handleRescheduleInterview = async (candidate) => {
    try {
      const token = localStorage.getItem("token");
      const interviewForm = getInterviewForm(candidate);

      if (!candidate.interview_id) {
        setActionMessage("No interview exists for this application");
        return;
      }

      setBusyApplicationId(candidate.application_id);
      setActionMessage("");

      const response = await rescheduleInterview(
        candidate.interview_id,
        {
          interview_date: interviewForm.interview_date,
          interview_time: interviewForm.interview_time,
        },
        token
      );

      updateCandidateInterviewState(
        candidate.application_id,
        response.data.interview,
        "Interview Scheduled"
      );

      setActionMessage(response.data.message || "Interview rescheduled");
    } catch (error) {
      console.log("RESCHEDULE INTERVIEW ERROR:", error.response?.data || error.message);
      setActionMessage(error.response?.data?.error || "Interview rescheduling failed");
    } finally {
      setBusyApplicationId(null);
    }
  };

  const handleCancelInterview = async (candidate) => {
    try {
      const token = localStorage.getItem("token");

      if (!candidate.interview_id) {
        setActionMessage("No interview exists for this application");
        return;
      }

      setBusyApplicationId(candidate.application_id);
      setActionMessage("");

      const response = await cancelInterview(candidate.interview_id, token);

      setApplicants((previousApplicants) =>
        previousApplicants.map((applicant) =>
          applicant.application_id === candidate.application_id
            ? {
                ...applicant,
                application_status:
                  response.data.application?.application_status || "Shortlisted",
                has_interview: false,
                interview_scheduled: false,
                interview_id: null,
                interview_status: "Cancelled",
                meeting_link: null,
                contact_visible: true,
              }
            : applicant
        )
      );

      setActionMessage(response.data.message || "Interview cancelled");
    } catch (error) {
      console.log("CANCEL INTERVIEW ERROR:", error.response?.data || error.message);
      setActionMessage(error.response?.data?.error || "Interview cancellation failed");
    } finally {
      setBusyApplicationId(null);
    }
  };

  const handleViewApplicantResume = async (candidate) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setActionMessage("Please login again");
        return;
      }

      setBusyResumeApplicationId(candidate.application_id);
      setActionMessage("Opening resume securely...");

      const response = await viewApplicantResume(candidate.application_id, token);

      openPdfBlob(response.data);
      setActionMessage("Resume opened securely");
    } catch (error) {
      console.log(
        "VIEW APPLICANT RESUME ERROR:",
        error.response?.data || error.message
      );

      setActionMessage("Unable to open applicant resume");
    } finally {
      setBusyResumeApplicationId(null);
    }
  };

  const handleDownloadApplicantResume = async (candidate) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setActionMessage("Please login again");
        return;
      }

      setBusyResumeApplicationId(candidate.application_id);
      setActionMessage("Downloading resume securely...");

      const response = await downloadApplicantResume(
        candidate.application_id,
        token
      );

      downloadPdfBlob(response.data, candidate.resume_url || "applicant-resume.pdf");
      setActionMessage("Resume downloaded securely");
    } catch (error) {
      console.log(
        "DOWNLOAD APPLICANT RESUME ERROR:",
        error.response?.data || error.message
      );

      setActionMessage("Unable to download applicant resume");
    } finally {
      setBusyResumeApplicationId(null);
    }
  };

  const toggleDetails = (candidate) => {
    setExpandedApplicationId((currentId) =>
      currentId === candidate.application_id ? null : candidate.application_id
    );
  };

  const renderContactDetails = (candidate) => {
    if (!candidate.contact_visible) {
      return (
        <div className="privacy-note recruiter-note">
          Contact details are shown after shortlist/interview stages to protect
          candidate privacy.
        </div>
      );
    }

    return (
      <div className="preview-grid">
        <div>
          <span>Email</span>
          <strong>{displayValue(candidate.email)}</strong>
        </div>
        <div>
          <span>Phone</span>
          <strong>{displayValue(candidate.phone_number)}</strong>
        </div>
        <div>
          <span>Address</span>
          <strong>{displayValue(candidate.address)}</strong>
        </div>
        <div>
          <span>Links</span>
          <strong className="link-list">
            {renderExternalLink("LinkedIn", candidate.linkedin_url)}
            {renderExternalLink("GitHub", candidate.github_url)}
            {renderExternalLink("Portfolio", candidate.portfolio_url)}
            {!candidate.linkedin_url &&
              !candidate.github_url &&
              !candidate.portfolio_url &&
              "Not added"}
          </strong>
        </div>
      </div>
    );
  };

  const renderInterviewManager = (candidate) => {
    const interviewForm = getInterviewForm(candidate);
    const canSchedule =
      candidate.application_status === "Shortlisted" && !candidate.has_interview;
    const canManageInterview =
      candidate.has_interview && candidate.application_status !== "Rejected";

    return (
      <div className="interview-manager-card">
        <div>
          <p className="preview-label">Interview Management</p>
          <p className="muted compact-muted">
            {candidate.has_interview
              ? `${candidate.interview_status || "Scheduled"} on ${formatInterviewDate(
                  candidate.interview_date
                )} at ${candidate.interview_time || "Not set"}`
              : "Schedule an interview after shortlisting the candidate."}
          </p>
        </div>

        <div className="interview-form-row">
          <label>
            Date
            <input
              type="date"
              value={interviewForm.interview_date}
              onChange={(event) =>
                handleInterviewInputChange(
                  candidate.application_id,
                  "interview_date",
                  event.target.value
                )
              }
              disabled={candidate.application_status === "Rejected"}
            />
          </label>
          <label>
            Time
            <input
              type="time"
              value={interviewForm.interview_time}
              onChange={(event) =>
                handleInterviewInputChange(
                  candidate.application_id,
                  "interview_time",
                  event.target.value
                )
              }
              disabled={candidate.application_status === "Rejected"}
            />
          </label>
        </div>

        <div className="button-row compact-row">
          {!candidate.has_interview ? (
            <button
              className="secondary-button small-button"
              onClick={() => handleInterview(candidate)}
              disabled={!canSchedule || busyApplicationId === candidate.application_id}
            >
              Schedule Interview
            </button>
          ) : (
            <>
              <button
                className="secondary-button small-button"
                onClick={() => handleRescheduleInterview(candidate)}
                disabled={!canManageInterview || busyApplicationId === candidate.application_id}
              >
                Reschedule
              </button>
              <button
                className="danger-button small-button"
                onClick={() => handleCancelInterview(candidate)}
                disabled={!canManageInterview || busyApplicationId === candidate.application_id}
              >
                Cancel Interview
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderCandidateDetails = (candidate) => (
    <div className="candidate-preview-box">
      <div className="preview-grid">
        <div>
          <span>Preferred Role</span>
          <strong>{displayValue(candidate.preferred_role)}</strong>
        </div>
        <div>
          <span>Preferred Location</span>
          <strong>{displayValue(candidate.preferred_location)}</strong>
        </div>
        <div>
          <span>Current Location</span>
          <strong>{displayValue(candidate.current_location)}</strong>
        </div>
        <div>
          <span>Expected Salary</span>
          <strong>{displayValue(candidate.expected_salary)}</strong>
        </div>
        <div>
          <span>Education</span>
          <strong>{displayValue(candidate.education)}</strong>
        </div>
        <div>
          <span>Applied At</span>
          <strong>{formatDate(candidate.applied_at)}</strong>
        </div>
      </div>

      <div className="preview-section">
        <p className="preview-label">Professional Summary</p>
        <p className="preview-text-block">
          {displayValue(candidate.professional_summary)}
        </p>
      </div>

      <div className="preview-section">
        <p className="preview-label">Contact Details</p>
        {renderContactDetails(candidate)}
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

      <div className="preview-section">
        <p className="preview-label">Projects</p>
        <p className="preview-text-block">{displayValue(candidate.projects)}</p>
      </div>

      <div className="preview-section">
        <p className="preview-label">Certifications</p>
        <p className="preview-text-block">
          {displayValue(candidate.certifications)}
        </p>
      </div>

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

      {renderInterviewManager(candidate)}

      <div className="preview-footer resume-footer">
        <div className="resume-file-name">
          <span>Resume</span>
          <strong>{candidate.resume_url ? candidate.resume_url : "Not uploaded"}</strong>
        </div>

        <div className="button-row compact-row">
          <button
            className="secondary-button small-button"
            onClick={() => handleViewApplicantResume(candidate)}
            disabled={
              !candidate.resume_url ||
              busyResumeApplicationId === candidate.application_id
            }
          >
            View Resume
          </button>
          <button
            className="secondary-button small-button"
            onClick={() => handleDownloadApplicantResume(candidate)}
            disabled={
              !candidate.resume_url ||
              busyResumeApplicationId === candidate.application_id
            }
          >
            Download
          </button>
        </div>

        {candidate.has_interview && <span>Interview already scheduled</span>}
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

      {recruiterApproval.status === "pending" && (
        <div className="recruiter-approval-notice pending" role="status">
          <strong>Recruiter approval pending</strong>
          <span>
            Your account is awaiting admin approval. You can review existing
            information, but you cannot post new jobs yet.
          </span>
          {recruiterApproval.reason && <small>{recruiterApproval.reason}</small>}
        </div>
      )}

      {recruiterApproval.status === "blocked" && (
        <div className="recruiter-approval-notice blocked" role="alert">
          <strong>Recruiter account blocked</strong>
          <span>
            Job posting is disabled for this account. Contact the platform admin
            for assistance.
          </span>
          {recruiterApproval.reason && <small>{recruiterApproval.reason}</small>}
        </div>
      )}

      <section className="panel recruiter-company-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Employer Identity</p>
            <h2>Company Profile</h2>
            <p className="muted">
              Company verification helps candidates trust your jobs.
            </p>
          </div>
          <span
            className={statusClass(
              companyProfile?.verification_status || "pending"
            )}
          >
            {companyProfile?.verification_status
              ? companyProfile.verification_status.replace(/_/g, " ")
              : "Not submitted"}
          </span>
        </div>

        {companyProfile?.verification_status === "verified" ? (
          <div className="company-verification-notice verified" role="status">
            <strong>Verified company</strong>
            <span>
              This company profile has been verified by a HirePilot admin.
            </span>
          </div>
        ) : (
          <div
            className={`company-verification-notice ${
              companyProfile?.verification_status || "pending"
            }`}
            role={
              companyProfile?.verification_status === "rejected"
                ? "alert"
                : "status"
            }
          >
            <strong>
              {companyProfile?.verification_status === "rejected"
                ? "Company verification rejected"
                : companyProfile?.verification_status === "needs_review"
                ? "Company changes need review"
                : "Company verification pending"}
            </strong>
            <span>
              Your approved recruiter account can continue using existing job
              posting features, but candidates will not see this company as a
              verified employer yet.
            </span>
          </div>
        )}

        {companyProfile?.verification_notes && (
          <div className="company-verification-notes">
            <strong>Admin verification notes</strong>
            <p>{companyProfile.verification_notes}</p>
          </div>
        )}

        {companyMessage && (
          <div className="notice-banner compact" role="status">
            {companyMessage}
          </div>
        )}
        {companyError && (
          <div className="notice-banner compact admin-error-notice" role="alert">
            {companyError}
          </div>
        )}

        {companyLoading ? (
          <p className="empty-state">Loading company profile...</p>
        ) : (
          <form
            className="recruiter-company-form"
            onSubmit={handleSaveCompanyProfile}
          >
            <div className="recruiter-company-form-grid">
              <label>
                Company name
                <input
                  type="text"
                  name="company_name"
                  value={companyForm.company_name}
                  onChange={handleCompanyInputChange}
                  placeholder="Company name"
                  required
                />
              </label>
              <label>
                Company website
                <input
                  type="text"
                  name="company_website"
                  value={companyForm.company_website}
                  onChange={handleCompanyInputChange}
                  placeholder="https://example.com"
                />
              </label>
              <label>
                Industry
                <input
                  type="text"
                  name="industry"
                  value={companyForm.industry}
                  onChange={handleCompanyInputChange}
                  placeholder="Technology"
                />
              </label>
              <label>
                Company size
                <input
                  type="text"
                  name="company_size"
                  value={companyForm.company_size}
                  onChange={handleCompanyInputChange}
                  placeholder="51-200 employees"
                />
              </label>
              <label className="recruiter-company-form-wide">
                Headquarters location
                <input
                  type="text"
                  name="headquarters_location"
                  value={companyForm.headquarters_location}
                  onChange={handleCompanyInputChange}
                  placeholder="Bengaluru, India"
                />
              </label>
              <label className="recruiter-company-form-wide">
                Company description
                <textarea
                  name="company_description"
                  value={companyForm.company_description}
                  onChange={handleCompanyInputChange}
                  placeholder="Describe the company, its work, and its culture."
                  rows="5"
                />
              </label>
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={companySaving}
            >
              {companySaving ? "Saving Company..." : "Save Company Profile"}
            </button>
          </form>
        )}
      </section>

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
                      <strong>
                        {candidate.current_location ||
                          candidate.preferred_location ||
                          "N/A"}
                      </strong>
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

                    {candidate.has_interview ? (
                      <button
                        className="secondary-button"
                        disabled={busyApplicationId === candidate.application_id}
                        onClick={() => handleRescheduleInterview(candidate)}
                      >
                        Reschedule
                      </button>
                    ) : (
                      <button
                        className="secondary-button"
                        disabled={
                          candidate.application_status !== "Shortlisted" ||
                          busyApplicationId === candidate.application_id
                        }
                        onClick={() => handleInterview(candidate)}
                      >
                        Schedule Interview
                      </button>
                    )}
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
