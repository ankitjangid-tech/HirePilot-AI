import { useEffect, useMemo, useState } from "react";
import "../App.css";

import {
  getRecruiters,
  updateRecruiterStatus,
  getExternalJobsForReview,
  reviewExternalJob,
} from "../services/adminService";

const statusClass = (status) =>
  `status-badge status-${String(status || "pending")
    .toLowerCase()
    .replace(/_/g, "-")}`;

const formatCreatedDate = (value) => {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString();
};

const reviewStatusLabel = (status) =>
  status === "pending_review"
    ? "Pending review"
    : String(status || "approved").replace(/_/g, " ");

function AdminDashboard() {
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyUserId, setBusyUserId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [externalJobs, setExternalJobs] = useState([]);
  const [externalJobsLoading, setExternalJobsLoading] = useState(true);
  const [busyExternalJobId, setBusyExternalJobId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});

  const statusCounts = useMemo(
    () =>
      recruiters.reduce(
        (counts, recruiter) => {
          const status = recruiter.recruiter_status || "pending";
          counts[status] = (counts[status] || 0) + 1;
          return counts;
        },
        { pending: 0, approved: 0, blocked: 0 }
      ),
    [recruiters]
  );

  const reviewCounts = useMemo(
    () =>
      externalJobs.reduce(
        (counts, externalJob) => {
          const status = externalJob.review_status || "approved";
          counts[status] = (counts[status] || 0) + 1;
          return counts;
        },
        { pending_review: 0, approved: 0, hidden: 0, rejected: 0 }
      ),
    [externalJobs]
  );

  useEffect(() => {
    fetchRecruiters();
    fetchExternalJobs();
  }, []);

  const fetchRecruiters = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token || localStorage.getItem("role") !== "admin") {
        setError("Admin access is required.");
        setLoading(false);
        return;
      }

      setLoading(true);

      setError("");
      const response = await getRecruiters(token);
      setRecruiters(response.data.recruiters || []);
    } catch (requestError) {
      console.log(
        "ADMIN RECRUITER FETCH ERROR:",
        requestError.response?.data || requestError.message
      );
      setError(requestError.response?.data?.error || "Unable to fetch recruiters");
    } finally {
      setLoading(false);
    }
  };

  const fetchExternalJobs = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token || localStorage.getItem("role") !== "admin") {
        setExternalJobsLoading(false);
        return;
      }

      setExternalJobsLoading(true);
      const response = await getExternalJobsForReview(token);
      const rows = response.data.externalJobs || [];

      setExternalJobs(rows);
      setReviewNotes(
        rows.reduce((notes, externalJob) => {
          notes[externalJob.external_job_id] = externalJob.review_notes || "";
          return notes;
        }, {})
      );
    } catch (requestError) {
      console.log(
        "ADMIN EXTERNAL JOB FETCH ERROR:",
        requestError.response?.data || requestError.message
      );
      setError(
        requestError.response?.data?.error ||
          "Unable to fetch external jobs for review"
      );
    } finally {
      setExternalJobsLoading(false);
    }
  };

  const handleStatusUpdate = async (userId, recruiterStatus) => {
    try {
      const token = localStorage.getItem("token");

      setBusyUserId(userId);
      setMessage("");
      setError("");

      const response = await updateRecruiterStatus(
        token,
        userId,
        recruiterStatus
      );

      setRecruiters((currentRecruiters) =>
        currentRecruiters.map((recruiter) =>
          recruiter.user_id === userId ? response.data.recruiter : recruiter
        )
      );
      setMessage(response.data.message || "Recruiter status updated");
    } catch (requestError) {
      console.log(
        "ADMIN RECRUITER STATUS ERROR:",
        requestError.response?.data || requestError.message
      );
      setError(
        requestError.response?.data?.error || "Unable to update recruiter status"
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const handleExternalJobReview = async (externalJobId, reviewStatus) => {
    try {
      const token = localStorage.getItem("token");

      setBusyExternalJobId(externalJobId);
      setMessage("");
      setError("");

      const response = await reviewExternalJob(
        token,
        externalJobId,
        reviewStatus,
        reviewNotes[externalJobId]
      );

      setExternalJobs((currentJobs) =>
        currentJobs.map((externalJob) =>
          externalJob.external_job_id === externalJobId
            ? { ...externalJob, ...response.data.externalJob }
            : externalJob
        )
      );
      setMessage(response.data.message || "External job review updated");
    } catch (requestError) {
      console.log(
        "ADMIN EXTERNAL JOB REVIEW ERROR:",
        requestError.response?.data || requestError.message
      );
      setError(
        requestError.response?.data?.error ||
          "Unable to update external job review"
      );
    } finally {
      setBusyExternalJobId(null);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    setMessage("");
    await Promise.all([fetchRecruiters(), fetchExternalJobs()]);
    setRefreshing(false);
  };

  return (
    <main className="dashboard-shell admin-dashboard">
      <section className="dashboard-hero admin-hero">
        <div>
          <p className="eyebrow">Platform Administration</p>
          <h1>Admin Dashboard</h1>
          <p className="muted">
            Review recruiter access and control who can publish jobs on
            HirePilot.
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={handleRefreshAll}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh Admin Data"}
        </button>
      </section>

      <section className="admin-summary-grid" aria-label="Recruiter summary">
        <article>
          <span>Total recruiters</span>
          <strong>{recruiters.length}</strong>
        </article>
        <article className="pending">
          <span>Pending</span>
          <strong>{statusCounts.pending}</strong>
        </article>
        <article className="approved">
          <span>Approved</span>
          <strong>{statusCounts.approved}</strong>
        </article>
        <article className="blocked">
          <span>Blocked</span>
          <strong>{statusCounts.blocked}</strong>
        </article>
      </section>

      {message && <div className="notice-banner">{message}</div>}
      {error && <div className="notice-banner admin-error-notice">{error}</div>}

      <section className="panel admin-recruiter-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Access Control</p>
            <h2>Recruiter Accounts</h2>
          </div>
          <span className="count-pill">{recruiters.length}</span>
        </div>

        {loading ? (
          <p className="empty-state">Loading recruiter accounts...</p>
        ) : recruiters.length === 0 ? (
          <p className="empty-state">No recruiter accounts found.</p>
        ) : (
          <div className="admin-recruiter-list">
            {recruiters.map((recruiter) => (
              <article className="admin-recruiter-card" key={recruiter.user_id}>
                <div className="admin-recruiter-identity">
                  <div>
                    <span className={statusClass(recruiter.recruiter_status)}>
                      {recruiter.recruiter_status || "pending"}
                    </span>
                    <h3>{recruiter.full_name || "Recruiter"}</h3>
                    <p>{recruiter.email}</p>
                  </div>
                  <div className="admin-recruiter-date">
                    <span>Created</span>
                    <strong>{formatCreatedDate(recruiter.created_at)}</strong>
                  </div>
                </div>

                {recruiter.recruiter_status_reason && (
                  <p className="admin-status-reason">
                    {recruiter.recruiter_status_reason}
                  </p>
                )}

                <div className="admin-recruiter-actions">
                  <button
                    type="button"
                    className="primary-button small-button"
                    onClick={() =>
                      handleStatusUpdate(recruiter.user_id, "approved")
                    }
                    disabled={
                      busyUserId === recruiter.user_id ||
                      recruiter.recruiter_status === "approved"
                    }
                  >
                    {busyUserId === recruiter.user_id
                      ? "Updating..."
                      : "Approve"}
                  </button>
                  <button
                    type="button"
                    className="danger-button small-button"
                    onClick={() =>
                      handleStatusUpdate(recruiter.user_id, "blocked")
                    }
                    disabled={
                      busyUserId === recruiter.user_id ||
                      recruiter.recruiter_status === "blocked"
                    }
                  >
                    {busyUserId === recruiter.user_id
                      ? "Updating..."
                      : "Block"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        className="admin-summary-grid external-review-summary-grid"
        aria-label="External job review summary"
      >
        <article className="pending">
          <span>Pending review</span>
          <strong>{reviewCounts.pending_review}</strong>
        </article>
        <article className="approved">
          <span>Approved</span>
          <strong>{reviewCounts.approved}</strong>
        </article>
        <article className="hidden">
          <span>Hidden</span>
          <strong>{reviewCounts.hidden}</strong>
        </article>
        <article className="blocked">
          <span>Rejected</span>
          <strong>{reviewCounts.rejected}</strong>
        </article>
      </section>

      <section className="panel admin-external-review-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Discovery Moderation</p>
            <h2>External Jobs Review</h2>
            <p className="muted">
              Only approved external jobs are visible and usable by candidates.
            </p>
          </div>
          <span className="count-pill">{externalJobs.length}</span>
        </div>

        {externalJobsLoading ? (
          <p className="empty-state">Loading external jobs...</p>
        ) : externalJobs.length === 0 ? (
          <p className="empty-state">No external jobs found.</p>
        ) : (
          <div className="admin-external-job-list">
            {externalJobs.map((externalJob) => (
              <article
                className="admin-external-job-card"
                key={externalJob.external_job_id}
              >
                <div className="admin-external-job-header">
                  <div>
                    <div className="admin-external-job-badges">
                      <span className={statusClass(externalJob.review_status)}>
                        {reviewStatusLabel(externalJob.review_status)}
                      </span>
                      <span className="source-tag">
                        {externalJob.source_platform || "External source"}
                      </span>
                    </div>
                    <h3>{externalJob.job_title}</h3>
                    <p>{externalJob.company_name}</p>
                  </div>
                  <div className="admin-recruiter-date">
                    <span>Discovered</span>
                    <strong>
                      {formatCreatedDate(
                        externalJob.discovered_at || externalJob.created_at
                      )}
                    </strong>
                  </div>
                </div>

                <div className="admin-external-job-meta">
                  <span>{externalJob.location || "Location not listed"}</span>
                  <span>
                    {String(externalJob.apply_mode || "Not specified").replace(
                      /_/g,
                      " "
                    )}
                  </span>
                </div>

                <label className="admin-review-notes">
                  Review notes
                  <textarea
                    value={reviewNotes[externalJob.external_job_id] || ""}
                    onChange={(event) =>
                      setReviewNotes((currentNotes) => ({
                        ...currentNotes,
                        [externalJob.external_job_id]: event.target.value,
                      }))
                    }
                    placeholder="Optional internal moderation note"
                    rows="2"
                  />
                </label>

                <div className="admin-external-job-actions">
                  <button
                    type="button"
                    className="primary-button small-button"
                    onClick={() =>
                      handleExternalJobReview(
                        externalJob.external_job_id,
                        "approved"
                      )
                    }
                    disabled={busyExternalJobId === externalJob.external_job_id}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="secondary-button small-button"
                    onClick={() =>
                      handleExternalJobReview(
                        externalJob.external_job_id,
                        "hidden"
                      )
                    }
                    disabled={busyExternalJobId === externalJob.external_job_id}
                  >
                    Hide
                  </button>
                  <button
                    type="button"
                    className="danger-button small-button"
                    onClick={() =>
                      handleExternalJobReview(
                        externalJob.external_job_id,
                        "rejected"
                      )
                    }
                    disabled={busyExternalJobId === externalJob.external_job_id}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="secondary-button small-button"
                    onClick={() =>
                      handleExternalJobReview(
                        externalJob.external_job_id,
                        "pending_review"
                      )
                    }
                    disabled={busyExternalJobId === externalJob.external_job_id}
                  >
                    {busyExternalJobId === externalJob.external_job_id
                      ? "Updating..."
                      : "Mark Pending"}
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

export default AdminDashboard;
