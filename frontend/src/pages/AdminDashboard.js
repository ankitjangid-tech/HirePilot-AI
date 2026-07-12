import { useEffect, useMemo, useState } from "react";
import "../App.css";

import {
  getRecruiters,
  updateRecruiterStatus,
} from "../services/adminService";

const statusClass = (status) =>
  `status-badge status-${String(status || "pending").toLowerCase()}`;

const formatCreatedDate = (value) => {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString();
};

function AdminDashboard() {
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyUserId, setBusyUserId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  useEffect(() => {
    fetchRecruiters();
  }, []);

  const fetchRecruiters = async ({ isRefresh = false } = {}) => {
    try {
      const token = localStorage.getItem("token");

      if (!token || localStorage.getItem("role") !== "admin") {
        setError("Admin access is required.");
        setLoading(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

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
      setRefreshing(false);
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
          onClick={() => fetchRecruiters({ isRefresh: true })}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh Recruiters"}
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
    </main>
  );
}

export default AdminDashboard;
