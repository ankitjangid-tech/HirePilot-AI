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
} from "../services/candidateService";
import { getMatchedJobs, autoApply } from "../services/jobService";
import {
  getApplications,
  getPendingApplications,
  completePendingApplication,
} from "../services/applicationService";

const emptyProfileForm = {
  skills: "",
  experience_years: "",
  preferred_role: "",
  preferred_location: "",
  expected_salary: "",
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
  general: "Update",
};

const buildProfileForm = (profile) => ({
  skills: profile?.skills || "",
  experience_years:
    profile?.experience_years === null || profile?.experience_years === undefined
      ? ""
      : profile.experience_years,
  preferred_role: profile?.preferred_role || "",
  preferred_location: profile?.preferred_location || "",
  expected_salary: profile?.expected_salary || "",
});

const statusClass = (status) =>
  `status-badge status-${String(status || "default")
    .toLowerCase()
    .replace(/\s+/g, "-")}`;

const notificationClass = (type) =>
  `status-badge status-${String(type || "general")
    .toLowerCase()
    .replace(/_/g, "-")}`;

function CandidateDashboard() {
  const [profile, setProfile] = useState(null);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [missingFields, setMissingFields] = useState([]);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [resumeFile, setResumeFile] = useState(null);

  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [message, setMessage] = useState("");
  const [resumeMessage, setResumeMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [uploadingResume, setUploadingResume] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [completingApplicationId, setCompletingApplicationId] = useState(null);
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
        skills: profileForm.skills,
        experience_years:
          profileForm.experience_years === ""
            ? null
            : Number(profileForm.experience_years),
        preferred_role: profileForm.preferred_role,
        preferred_location: profileForm.preferred_location,
        expected_salary: profileForm.expected_salary,
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
                <span>Skills</span>
                <strong>{profile.skills || "Not added"}</strong>
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
                <strong>{profile.preferred_role || "Not added"}</strong>
              </div>
              <div>
                <span>Preferred Location</span>
                <strong>{profile.preferred_location || "Not added"}</strong>
              </div>
              <div>
                <span>Expected Salary</span>
                <strong>{profile.expected_salary || "Not added"}</strong>
              </div>
              <div>
                <span>ATS Score</span>
                <strong>{profile.ats_score ?? "Not generated"}</strong>
              </div>
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

            {resumeMessage && <p className="helper-text">{resumeMessage}</p>}

            <div className="form-grid">
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
                    <a
                      href={notification.meeting_link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Join Meeting
                    </a>
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
