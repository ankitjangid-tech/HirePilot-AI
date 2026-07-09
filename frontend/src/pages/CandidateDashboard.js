import { useEffect, useState } from "react";
import "../App.css";

import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  cleanupDuplicateNotifications,
} from "../services/notificationService";
import {
  getProfile,
  updateProfile,
  uploadResume,
  viewMyResume,
  downloadMyResume,
} from "../services/candidateService";
import { getMatchedJobs, autoApply } from "../services/jobService";
import {
  getApplications,
  getPendingApplications,
  completePendingApplication,
} from "../services/applicationService";
import {
  getMatchedExternalJobs,
  getExternalApplications,
  getExternalAgentLogs,
  applyExternalJob,
  completeExternalApplication,
} from "../services/externalJobService";

const emptyProfileForm = {
  full_name: "",
  email: "",
  skills: "",
  experience_years: "",
  preferred_role: "",
  preferred_location: "",
  expected_salary: "",
  phone_number: "",
  current_location: "",
  address: "",
  linkedin_url: "",
  github_url: "",
  portfolio_url: "",
  education: "",
  projects: "",
  certifications: "",
  professional_summary: "",
};

const fieldLabels = {
  skills: "Skills",
  experience_years: "Experience Years",
  preferred_role: "Preferred Role",
  preferred_location: "Preferred Location",
  expected_salary: "Expected Salary",
};

const notificationLabels = {
  shortlisted: "Shortlisted",
  rejected: "Rejected",
  selected: "Selected",
  interview_scheduled: "Interview",
  interview_rescheduled: "Rescheduled",
  interview_cancelled: "Cancelled",
  general: "Update",
};

const agentStatusLabels = {
  auto_applied: "Auto Applied",
  pending_manual_action: "Manual Action",
  manual_completed: "Manually Completed",
  skipped_duplicate: "Skipped Duplicate",
  skipped_low_match: "Skipped Low Match",
  failed: "Failed",
};

const actionTypeLabels = {
  external_apply_attempt: "External apply attempt",
  manual_completion_confirmation: "Candidate manual completion",
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
  link.download = filename || "candidate-resume.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(fileUrl);
  }, 60000);
};

const buildProfileForm = (profile) => ({
  full_name: profile?.full_name || "",
  email: profile?.email || "",
  skills: profile?.skills || "",
  experience_years:
    profile?.experience_years === null || profile?.experience_years === undefined
      ? ""
      : profile.experience_years,
  preferred_role: profile?.preferred_role || "",
  preferred_location: profile?.preferred_location || "",
  expected_salary: profile?.expected_salary || "",
  phone_number: profile?.phone_number || "",
  current_location: profile?.current_location || "",
  address: profile?.address || "",
  linkedin_url: profile?.linkedin_url || "",
  github_url: profile?.github_url || "",
  portfolio_url: profile?.portfolio_url || "",
  education: profile?.education || "",
  projects: profile?.projects || "",
  certifications: profile?.certifications || "",
  professional_summary: profile?.professional_summary || "",
});

const statusClass = (status) =>
  `status-badge status-${String(status || "default")
    .toLowerCase()
    .replace(/\s+/g, "-")}`;

const notificationClass = (type) =>
  `status-badge status-${String(type || "general")
    .toLowerCase()
    .replace(/_/g, "-")}`;

const displayValue = (value) => value || "Not added";

function CandidateDashboard() {
  const [profile, setProfile] = useState(null);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [missingFields, setMissingFields] = useState([]);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [resumeFile, setResumeFile] = useState(null);

  const [jobs, setJobs] = useState([]);
  const [externalJobs, setExternalJobs] = useState([]);
  const [externalApplications, setExternalApplications] = useState([]);
  const [externalAgentLogs, setExternalAgentLogs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [message, setMessage] = useState("");
  const [externalMessage, setExternalMessage] = useState("");
  const [resumeMessage, setResumeMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeActionLoading, setResumeActionLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [completingApplicationId, setCompletingApplicationId] = useState(null);
  const [externalApplyingId, setExternalApplyingId] = useState(null);
  const [completingExternalApplicationId, setCompletingExternalApplicationId] = useState(null);
  const [notificationActionLoading, setNotificationActionLoading] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setMessage("Please login again");
        return;
      }

      const profileResponse = await getProfile(token);
      const profileData = profileResponse.data;

      setProfile(profileData.profile);
      setProfileCompleted(profileData.profile_completed);
      setMissingFields(profileData.missing_fields || []);
      setProfileForm(buildProfileForm(profileData.profile));

      const jobsResponse = await getMatchedJobs(token);
      setJobs(jobsResponse.data.matchedJobs || []);

      const externalJobsResponse = await getMatchedExternalJobs(token);
      setExternalJobs(externalJobsResponse.data.matchedExternalJobs || []);

      const externalApplicationsResponse = await getExternalApplications(token);
      setExternalApplications(
        externalApplicationsResponse.data.externalApplications || []
      );

      try {
        const externalAgentLogsResponse = await getExternalAgentLogs(token);
        setExternalAgentLogs(externalAgentLogsResponse.data.agentLogs || []);
      } catch (agentLogError) {
        console.log(
          "EXTERNAL AGENT LOG FETCH ERROR:",
          agentLogError.response?.data || agentLogError.message
        );
        setExternalAgentLogs([]);
      }

      const applicationsResponse = await getApplications(token);
      setApplications(
        (applicationsResponse.data.applications || []).filter(
          (application) => application.application_status !== "Pending"
        )
      );

      const pendingResponse = await getPendingApplications(token);
      setPendingApplications(pendingResponse.data.pendingApplications || []);

      const notificationsResponse = await getNotifications(token);
      const notificationRows = notificationsResponse.data.notifications || [];

      setNotifications(notificationRows);
      setUnreadCount(
        notificationsResponse.data.unread_count ??
          notificationRows.filter(
            (notification) => notification.notification_id && !notification.is_read
          ).length
      );
    } catch (error) {
      console.log("DASHBOARD FETCH ERROR:", error.response?.data || error.message);
      setMessage("Unable to refresh dashboard");
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleProfileInputChange = (event) => {
    const { name, value } = event.target;

    setProfileForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const handleResumeUpload = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setResumeMessage("Please login again");
        return;
      }

      if (!resumeFile) {
        setResumeMessage("Please select a resume PDF first");
        return;
      }

      setUploadingResume(true);
      setResumeMessage("Uploading resume...");

      const response = await uploadResume(token, resumeFile);

      setResumeMessage(response.data.message);
      setResumeFile(null);

      await fetchDashboardData();
    } catch (error) {
      console.log("RESUME UPLOAD ERROR:", error.response?.data || error.message);
      setResumeMessage(error.response?.data?.error || "Resume upload failed");
    } finally {
      setUploadingResume(false);
    }
  };

  const handleViewResume = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setResumeMessage("Please login again");
        return;
      }

      setResumeActionLoading(true);
      setResumeMessage("Opening resume...");

      const response = await viewMyResume(token);

      openPdfBlob(response.data);
      setResumeMessage("Resume opened securely");
    } catch (error) {
      console.log("VIEW RESUME ERROR:", error.response?.data || error.message);
      setResumeMessage("Unable to open resume. Please upload a resume first.");
    } finally {
      setResumeActionLoading(false);
    }
  };

  const handleDownloadResume = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setResumeMessage("Please login again");
        return;
      }

      setResumeActionLoading(true);
      setResumeMessage("Downloading resume...");

      const response = await downloadMyResume(token);

      downloadPdfBlob(response.data, profile?.resume_url || "candidate-resume.pdf");
      setResumeMessage("Resume downloaded securely");
    } catch (error) {
      console.log("DOWNLOAD RESUME ERROR:", error.response?.data || error.message);
      setResumeMessage("Unable to download resume. Please upload a resume first.");
    } finally {
      setResumeActionLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setProfileMessage("Please login again");
        return;
      }

      setSavingProfile(true);
      setProfileMessage("Saving profile...");

      const payload = {
        full_name: profileForm.full_name,
        skills: profileForm.skills,
        experience_years:
          profileForm.experience_years === ""
            ? null
            : Number(profileForm.experience_years),
        preferred_role: profileForm.preferred_role,
        preferred_location: profileForm.preferred_location,
        expected_salary: profileForm.expected_salary,
        phone_number: profileForm.phone_number,
        current_location: profileForm.current_location,
        address: profileForm.address,
        linkedin_url: profileForm.linkedin_url,
        github_url: profileForm.github_url,
        portfolio_url: profileForm.portfolio_url,
        education: profileForm.education,
        projects: profileForm.projects,
        certifications: profileForm.certifications,
        professional_summary: profileForm.professional_summary,
      };

      const response = await updateProfile(token, payload);

      setProfileMessage(response.data.message);

      await fetchDashboardData();
    } catch (error) {
      console.log("PROFILE UPDATE ERROR:", error.response?.data || error.message);
      setProfileMessage(error.response?.data?.error || "Unable to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAutoApply = async () => {
    try {
      const token = localStorage.getItem("token");

      const response = await autoApply(token);

      setMessage(
        `${response.data.message} | Success: ${
          response.data.successful_applications || 0
        } | Pending: ${response.data.pending_applications || 0} | Skipped: ${
          response.data.skipped_applications || 0
        }`
      );

      await fetchDashboardData();
    } catch (error) {
      console.log("AUTO APPLY ERROR:", error.response?.data || error.message);
      setMessage(error.response?.data?.error || "Auto Apply failed");
    }
  };

  const handleApplyExternalJob = async (externalJobId) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setExternalMessage("Please login again");
        return;
      }

      setExternalApplyingId(externalJobId);
      setExternalMessage("Attempting external application...");

      const response = await applyExternalJob(token, externalJobId);

      setExternalMessage(response.data.message);
      await fetchDashboardData();
    } catch (error) {
      console.log("EXTERNAL APPLY ERROR:", error.response?.data || error.message);
      setExternalMessage(
        error.response?.data?.error || "External application failed"
      );
    } finally {
      setExternalApplyingId(null);
    }
  };

  const handleCompleteExternalApplication = async (externalApplicationId) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setExternalMessage("Please login again");
        return;
      }

      setCompletingExternalApplicationId(externalApplicationId);
      setExternalMessage("Marking manual completion...");

      const response = await completeExternalApplication(token, externalApplicationId);

      setExternalMessage(response.data.message);
      await fetchDashboardData();
    } catch (error) {
      console.log(
        "COMPLETE EXTERNAL APPLICATION ERROR:",
        error.response?.data || error.message
      );
      setExternalMessage(
        error.response?.data?.error || "Unable to complete external application"
      );
    } finally {
      setCompletingExternalApplicationId(null);
    }
  };

  const handleCompleteApplication = async (applicationId) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setMessage("Please login again");
        return;
      }

      setCompletingApplicationId(applicationId);

      const response = await completePendingApplication(token, applicationId);

      setMessage(response.data.message);

      await fetchDashboardData();
    } catch (error) {
      console.log(
        "COMPLETE APPLICATION ERROR:",
        error.response?.data || error.message
      );

      setMessage(error.response?.data?.error || "Unable to complete application");
    } finally {
      setCompletingApplicationId(null);
    }
  };

  const handleMarkNotificationRead = async (notificationId) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setNotificationMessage("Please login again");
        return;
      }

      setNotificationActionLoading(true);
      const response = await markNotificationRead(token, notificationId);
      setNotificationMessage(response.data.message);
      await fetchDashboardData();
    } catch (error) {
      console.log(
        "MARK NOTIFICATION READ ERROR:",
        error.response?.data || error.message
      );
      setNotificationMessage(
        error.response?.data?.error || "Unable to update notification"
      );
    } finally {
      setNotificationActionLoading(false);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setNotificationMessage("Please login again");
        return;
      }

      setNotificationActionLoading(true);
      const response = await markAllNotificationsRead(token);
      setNotificationMessage(response.data.message);
      await fetchDashboardData();
    } catch (error) {
      console.log(
        "MARK ALL NOTIFICATIONS READ ERROR:",
        error.response?.data || error.message
      );
      setNotificationMessage(
        error.response?.data?.error || "Unable to update notifications"
      );
    } finally {
      setNotificationActionLoading(false);
    }
  };

  const handleCleanupDuplicateNotifications = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setNotificationMessage("Please login again");
        return;
      }

      setNotificationActionLoading(true);
      const response = await cleanupDuplicateNotifications(token);
      setNotificationMessage(
        `${response.data.message} | Removed: ${response.data.deleted_count || 0}`
      );
      await fetchDashboardData();
    } catch (error) {
      console.log(
        "CLEANUP NOTIFICATIONS ERROR:",
        error.response?.data || error.message
      );
      setNotificationMessage(
        error.response?.data?.error || "Unable to clean duplicate notifications"
      );
    } finally {
      setNotificationActionLoading(false);
    }
  };

  const upcomingInterviews = notifications.filter(
    (notification) =>
      notification.reference_type === "interview" &&
      notification.interview_date &&
      notification.notification_type !== "interview_cancelled"
  );

  return (
    <main className="dashboard-shell">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Candidate Portal</p>
          <h1>Candidate Dashboard</h1>
          <p className="muted">
            Manage your profile, matched jobs, applications, and interview updates.
          </p>
        </div>

        <button className="primary-button" onClick={handleAutoApply}>
          Auto Apply
        </button>
      </section>

      {message && <div className="notice-banner">{message}</div>}

      {profile && (
      <section className="dashboard-grid two-column">
          <div className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Profile</p>
                <h2>Profile Status</h2>
              </div>
              <span
                className={
                  profileCompleted
                    ? "status-badge status-completed"
                    : "status-badge status-pending"
                }
              >
                {profileCompleted ? "Completed" : "Incomplete"}
              </span>
            </div>

            {!profileCompleted && (
              <div className="missing-box">
                <strong>Missing Fields</strong>
                <div className="chip-row">
                  {missingFields.map((field) => (
                    <span className="chip warning" key={field}>
                      {fieldLabels[field] || field}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="detail-grid">
              <div>
                <span>Name</span>
                <strong>{displayValue(profile.full_name)}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{displayValue(profile.email)}</strong>
              </div>
              <div>
                <span>Phone</span>
                <strong>{displayValue(profile.phone_number)}</strong>
              </div>
              <div>
                <span>Current Location</span>
                <strong>{displayValue(profile.current_location)}</strong>
              </div>
              <div>
                <span>Skills</span>
                <strong>{displayValue(profile.skills)}</strong>
              </div>
              <div>
                <span>Experience</span>
                <strong>
                  {profile.experience_years === null ||
                  profile.experience_years === undefined
                    ? "Not added"
                    : `${profile.experience_years} years`}
                </strong>
              </div>
              <div>
                <span>Preferred Role</span>
                <strong>{displayValue(profile.preferred_role)}</strong>
              </div>
              <div>
                <span>Preferred Location</span>
                <strong>{displayValue(profile.preferred_location)}</strong>
              </div>
              <div>
                <span>Expected Salary</span>
                <strong>{displayValue(profile.expected_salary)}</strong>
              </div>
              <div>
                <span>ATS Score</span>
                <strong>{profile.ats_score ?? "Not generated"}</strong>
              </div>
            </div>

            <div className="profile-summary-block">
              <span>Professional Summary</span>
              <p>{displayValue(profile.professional_summary)}</p>
            </div>
          </div>

          <div className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Resume</p>
                <h2>Upload & Complete Profile</h2>
              </div>
            </div>

            <div className="upload-row">
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setResumeFile(event.target.files[0])}
              />
              <button
                className="secondary-button"
                onClick={handleResumeUpload}
                disabled={uploadingResume}
              >
                {uploadingResume ? "Uploading..." : "Upload Resume"}
              </button>
            </div>

            <div className="resume-access-card">
              <div>
                <span>Current Resume</span>
                <strong>{profile.resume_url || "Not uploaded"}</strong>
              </div>
              <div className="button-row compact-row">
                <button
                  className="secondary-button"
                  onClick={handleViewResume}
                  disabled={!profile.resume_url || resumeActionLoading}
                >
                  View Resume
                </button>
                <button
                  className="secondary-button"
                  onClick={handleDownloadResume}
                  disabled={!profile.resume_url || resumeActionLoading}
                >
                  Download Resume
                </button>
              </div>
            </div>

            {resumeMessage && <p className="helper-text">{resumeMessage}</p>}

            <div className="form-grid">
              <div className="profile-form-section">
                <h3>Core Matching Details</h3>
                <label>
                  Skills
                  <input
                    name="skills"
                    value={profileForm.skills}
                    onChange={handleProfileInputChange}
                    placeholder="Python, SQL, React"
                  />
                </label>

                <label>
                  Experience Years
                  <input
                    name="experience_years"
                    type="number"
                    min="0"
                    value={profileForm.experience_years}
                    onChange={handleProfileInputChange}
                    placeholder="0"
                  />
                </label>

                <label>
                  Preferred Role
                  <input
                    name="preferred_role"
                    value={profileForm.preferred_role}
                    onChange={handleProfileInputChange}
                    placeholder="AI Engineer"
                  />
                </label>

                <label>
                  Preferred Location
                  <input
                    name="preferred_location"
                    value={profileForm.preferred_location}
                    onChange={handleProfileInputChange}
                    placeholder="Jaipur, Remote"
                  />
                </label>

                <label>
                  Expected Salary
                  <input
                    name="expected_salary"
                    value={profileForm.expected_salary}
                    onChange={handleProfileInputChange}
                    placeholder="10 LPA"
                  />
                </label>
              </div>

              <div className="profile-form-section">
                <h3>Personal Contact Details</h3>
                <p className="privacy-note">
                  Email is login identity and cannot be changed here. Recruiters see
                  contact details only after shortlist/interview stages.
                </p>

                <label>
                  Full Name
                  <input
                    name="full_name"
                    value={profileForm.full_name}
                    onChange={handleProfileInputChange}
                    placeholder="Candidate name"
                  />
                </label>

                <label>
                  Email
                  <input name="email" value={profileForm.email} disabled />
                </label>

                <label>
                  Phone Number
                  <input
                    name="phone_number"
                    value={profileForm.phone_number}
                    onChange={handleProfileInputChange}
                    placeholder="+91 90000 00000"
                  />
                </label>

                <label>
                  Current Location
                  <input
                    name="current_location"
                    value={profileForm.current_location}
                    onChange={handleProfileInputChange}
                    placeholder="Jaipur, Rajasthan"
                  />
                </label>

                <label>
                  Address
                  <textarea
                    name="address"
                    value={profileForm.address}
                    onChange={handleProfileInputChange}
                    placeholder="Optional full address"
                    rows="3"
                  />
                </label>
              </div>

              <div className="profile-form-section">
                <h3>Professional Links & Details</h3>
                <label>
                  LinkedIn URL
                  <input
                    name="linkedin_url"
                    value={profileForm.linkedin_url}
                    onChange={handleProfileInputChange}
                    placeholder="https://linkedin.com/in/username"
                  />
                </label>

                <label>
                  GitHub URL
                  <input
                    name="github_url"
                    value={profileForm.github_url}
                    onChange={handleProfileInputChange}
                    placeholder="https://github.com/username"
                  />
                </label>

                <label>
                  Portfolio URL
                  <input
                    name="portfolio_url"
                    value={profileForm.portfolio_url}
                    onChange={handleProfileInputChange}
                    placeholder="https://yourportfolio.com"
                  />
                </label>

                <label>
                  Education
                  <textarea
                    name="education"
                    value={profileForm.education}
                    onChange={handleProfileInputChange}
                    placeholder="MCA, B.Tech, certifications, college details"
                    rows="3"
                  />
                </label>

                <label>
                  Projects
                  <textarea
                    name="projects"
                    value={profileForm.projects}
                    onChange={handleProfileInputChange}
                    placeholder="Important projects with tech stack and impact"
                    rows="4"
                  />
                </label>

                <label>
                  Certifications
                  <textarea
                    name="certifications"
                    value={profileForm.certifications}
                    onChange={handleProfileInputChange}
                    placeholder="AWS, Google, Coursera, internship certificates"
                    rows="3"
                  />
                </label>

                <label>
                  Professional Summary
                  <textarea
                    name="professional_summary"
                    value={profileForm.professional_summary}
                    onChange={handleProfileInputChange}
                    placeholder="Brief candidate summary for recruiters"
                    rows="4"
                  />
                </label>
              </div>

              <button
                className="primary-button"
                onClick={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? "Saving..." : "Save Profile"}
              </button>
            </div>

            {profileMessage && <p className="helper-text">{profileMessage}</p>}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Matching</p>
            <h2>Matched Jobs</h2>
          </div>
          <span className="count-pill">{jobs.length}</span>
        </div>

        {jobs.length === 0 ? (
          <p className="empty-state">No matched jobs found yet.</p>
        ) : (
          <div className="card-grid">
            {jobs.map((job) => (
              <article className="item-card" key={job.job_id}>
                <div>
                  <h3>{job.job_title}</h3>
                  <p>{job.company_name}</p>
                </div>
                <span className="score-pill">{job.match_score}% match</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel external-discovery-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">External Discovery</p>
          <h2>External Matched Jobs</h2>
          <p className="muted">
            Phase 1 uses safe simulated external sources. Future agent layer will
            connect company career pages and supported job portals.
          </p>
        </div>
        <span className="count-pill">{externalJobs.length}</span>
      </div>

      {externalMessage && <div className="notice-banner compact">{externalMessage}</div>}

      {externalJobs.length === 0 ? (
        <p className="empty-state">No external matched jobs found yet.</p>
      ) : (
        <div className="card-grid external-card-grid">
          {externalJobs.map((job) => (
            <article className="item-card external-job-card" key={job.external_job_id}>
              <div className="external-card-topline">
                <span className="source-tag">{job.source_platform}</span>
                <span className="score-pill">{job.match_score}% match</span>
              </div>

              <div>
                <h3>{job.job_title}</h3>
                <p>{job.company_name}</p>
              </div>

              <div className="external-meta-row">
                <span>{job.location || "Location not listed"}</span>
                <span>{job.salary || "Salary not listed"}</span>
                <span>
                  {job.apply_mode === "easy_apply"
                    ? "Auto-apply possible"
                    : "Manual questions likely"}
                </span>
              </div>

              <div>
                <span className="mini-label">Matched Skills</span>
                <div className="chip-row">
                  {(job.matched_skills || []).map((skill) => (
                    <span className="chip success" key={skill}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="external-actions-row">
                {job.application_status ? (
                  <span className={statusClass(job.application_status)}>
                    {job.application_status}
                  </span>
                ) : (
                  <button
                    className="primary-button"
                    onClick={() => handleApplyExternalJob(job.external_job_id)}
                    disabled={externalApplyingId === job.external_job_id}
                  >
                    {externalApplyingId === job.external_job_id
                      ? "Applying..."
                      : "Apply with HirePilot"}
                  </button>
                )}

                <a
                  className="secondary-button link-button"
                  href={job.job_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Source
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
      </section>


      <section className="dashboard-grid two-column">
        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Applications</p>
              <h2>My Applications</h2>
            </div>
            <span className="count-pill">{applications.length}</span>
          </div>

          {applications.length === 0 ? (
            <p className="empty-state">No submitted applications yet.</p>
          ) : (
            <div className="stack-list">
              {applications.map((application) => (
                <article className="list-card" key={application.application_id}>
                  <div>
                    <h3>{application.job_title}</h3>
                    <p>{application.company_name}</p>
                  </div>
                  <span className={statusClass(application.application_status)}>
                    {application.application_status}
                  </span>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Fallback</p>
              <h2>Pending Applications</h2>
            </div>
            <span className="count-pill">{pendingApplications.length}</span>
          </div>

          {pendingApplications.length === 0 ? (
            <p className="empty-state">No pending applications.</p>
          ) : (
            <div className="stack-list">
              {pendingApplications.map((application) => (
                <article className="list-card" key={application.application_id}>
                  <div>
                    <h3>{application.job_title || `Job ${application.job_id}`}</h3>
                    <p>{application.company_name || "Manual completion needed"}</p>
                    <span className={statusClass(application.application_status)}>
                      {application.application_status}
                    </span>
                  </div>

                  <button
                    className="secondary-button"
                    onClick={() =>
                      handleCompleteApplication(application.application_id)
                    }
                    disabled={completingApplicationId === application.application_id}
                  >
                    {completingApplicationId === application.application_id
                      ? "Completing..."
                      : "Complete Application"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">External Applications</p>
            <h2>External Apply Tracker</h2>
            <p className="muted">
              For manual-pending jobs, open the source page first. After you
              finish the external form, mark it completed here.
            </p>
          </div>
          <span className="count-pill">{externalApplications.length}</span>
        </div>

        {externalApplications.length === 0 ? (
          <p className="empty-state">No external applications yet.</p>
        ) : (
          <div className="stack-list">
            {externalApplications.map((application) => (
              <article
                className="list-card external-application-card"
                key={application.external_application_id}
              >
                <div>
                  <h3>{application.job_title}</h3>
                  <p>
                    {application.company_name} • {application.source_platform}
                  </p>
                  {application.failure_reason && (
                    <p className="helper-text compact-muted">
                      {application.failure_reason}
                    </p>
                  )}
                  {application.application_status === "Pending" && (
                    <p className="helper-text manual-action-note">
                      Open Source, complete the external application manually,
                      then click “I completed this manually”.
                    </p>
                  )}
                </div>

                <div className="external-actions-row">
                  <span className={statusClass(application.application_status)}>
                    {application.application_status}
                  </span>

                  {application.application_status === "Pending" && (
                    <button
                      className="secondary-button"
                      onClick={() =>
                        handleCompleteExternalApplication(
                          application.external_application_id
                        )
                      }
                      disabled={
                        completingExternalApplicationId ===
                        application.external_application_id
                      }
                    >
                      {completingExternalApplicationId ===
                      application.external_application_id
                        ? "Marking completed..."
                        : "I completed this manually"}
                    </button>
                  )}

                  <a
                    className="secondary-button link-button"
                    href={application.job_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Source
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel agent-activity-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">AI Agent Foundation</p>
            <h2>External Agent Activity</h2>
            <p className="muted">
              Phase 1 logs every external apply attempt, manual fallback, and
              candidate confirmation. Future LangGraph/Playwright agents will
              write richer automation events here.
            </p>
          </div>
          <span className="count-pill">{externalAgentLogs.length}</span>
        </div>

        {externalAgentLogs.length === 0 ? (
          <p className="empty-state">No external agent activity yet.</p>
        ) : (
          <div className="agent-log-list">
            {externalAgentLogs.map((log) => (
              <article className="agent-log-card" key={log.agent_attempt_id}>
                <div>
                  <span className={statusClass(log.attempt_status)}>
                    {agentStatusLabels[log.attempt_status] || log.attempt_status}
                  </span>
                  <h3>{log.job_title || "External job"}</h3>
                  <p>
                    {actionTypeLabels[log.action_type] || log.action_type} • {" "}
                    {log.company_name || "External company"}
                    {log.source_platform ? ` • ${log.source_platform}` : ""}
                  </p>
                  {log.failure_reason && (
                    <p className="helper-text compact-muted">
                      {log.failure_reason}
                    </p>
                  )}
                </div>
                <div className="agent-log-meta">
                  {log.metadata?.match_score !== undefined && (
                    <span>Match: {log.metadata.match_score}%</span>
                  )}
                  <span>{new Date(log.created_at).toLocaleString()}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Interviews</p>
            <h2>Upcoming Interviews</h2>
          </div>
          <span className="count-pill">{upcomingInterviews.length}</span>
        </div>

        {upcomingInterviews.length === 0 ? (
          <p className="empty-state">No upcoming interviews.</p>
        ) : (
          <div className="upcoming-interview-grid">
            {upcomingInterviews.map((interview, index) => (
              <article
                className="upcoming-interview-card"
                key={interview.reference_id || interview.notification_id || index}
              >
                <div>
                  <span className={notificationClass(interview.notification_type)}>
                    {notificationLabels[interview.notification_type] || "Interview"}
                  </span>
                  <h3>{interview.message}</h3>
                  <p>
                    {new Date(interview.interview_date).toLocaleDateString()} at{" "}
                    {interview.interview_time}
                  </p>
                </div>
                <a
                  className="secondary-button small-button link-button"
                  href={interview.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Join Meeting
                </a>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading notification-heading">
          <div>
            <p className="eyebrow">Updates</p>
            <h2>Notification Center</h2>
            <p className="muted">Unread: {unreadCount}</p>
          </div>
          <div className="button-row">
            <button
              className="secondary-button"
              onClick={handleMarkAllNotificationsRead}
              disabled={notificationActionLoading || unreadCount === 0}
            >
              Mark all read
            </button>
            <button
              className="danger-button"
              onClick={handleCleanupDuplicateNotifications}
              disabled={notificationActionLoading || notifications.length === 0}
            >
              Clean duplicates
            </button>
          </div>
        </div>

        {notificationMessage && (
          <div className="notice-banner compact">{notificationMessage}</div>
        )}

        {notifications.length === 0 ? (
          <p className="empty-state">No notifications yet.</p>
        ) : (
          <div className="stack-list">
            {notifications.map((notification, index) => (
              <article
                className={`notification-card ${
                  notification.notification_id && !notification.is_read ? "unread" : ""
                }`}
                key={
                  notification.notification_id ||
                  notification.reference_id ||
                  notification.interview_id ||
                  index
                }
              >
                <div className="notification-topline">
                  <span className={notificationClass(notification.notification_type)}>
                    {notificationLabels[notification.notification_type] || "Update"}
                  </span>
                  <span className="notification-date">
                    {notification.created_at
                      ? new Date(notification.created_at).toLocaleString()
                      : ""}
                  </span>
                </div>

                <p>{notification.message}</p>

                {notification.interview_date && (
                  <div className="interview-mini-card">
                    <p>
                      <strong>Interview Date:</strong>{" "}
                      {new Date(notification.interview_date).toLocaleDateString()}
                    </p>
                    <p>
                      <strong>Time:</strong> {notification.interview_time}
                    </p>
                    {notification.notification_type === "interview_cancelled" ? (
                      <p className="muted">This interview is no longer active.</p>
                    ) : (
                      <a
                        href={notification.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Join Meeting
                      </a>
                    )}
                  </div>
                )}

                {notification.notification_id && !notification.is_read && (
                  <button
                    className="secondary-button small-button"
                    onClick={() =>
                      handleMarkNotificationRead(notification.notification_id)
                    }
                    disabled={notificationActionLoading}
                  >
                    Mark as read
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default CandidateDashboard;
