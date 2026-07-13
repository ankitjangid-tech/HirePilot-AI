import { useEffect, useMemo, useState } from "react";
import "../App.css";

import {
  getRecruiters,
  updateRecruiterStatus,
  getExternalJobsForReview,
  getExternalSources,
  createExternalSource,
  updateExternalSource,
  runCrawl4AiDemoDiscovery,
  reviewExternalJob,
} from "../services/adminService";

const emptyExternalSourceForm = {
  source_name: "",
  source_key: "",
  source_type: "demo_raw_html",
  base_url: "",
  safety_mode: "manual_review",
  notes: "",
};

const externalSourceTypes = [
  { value: "demo_raw_html", label: "Demo raw HTML" },
  { value: "simulated_platform", label: "Simulated platform" },
  { value: "company_career_page", label: "Company career page" },
  { value: "job_board", label: "Job board" },
];

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
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryMessage, setDiscoveryMessage] = useState("");
  const [discoveryError, setDiscoveryError] = useState("");
  const [busyExternalJobId, setBusyExternalJobId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});
  const [externalSources, setExternalSources] = useState([]);
  const [externalSourcesLoading, setExternalSourcesLoading] = useState(true);
  const [externalSourceForm, setExternalSourceForm] = useState(
    emptyExternalSourceForm
  );
  const [sourceNotes, setSourceNotes] = useState({});
  const [sourceCreating, setSourceCreating] = useState(false);
  const [busySourceId, setBusySourceId] = useState(null);
  const [sourceMessage, setSourceMessage] = useState("");
  const [sourceError, setSourceError] = useState("");

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

  const crawl4AiDemoSource = useMemo(
    () =>
      externalSources.find((source) => source.source_key === "crawl4ai_demo") ||
      null,
    [externalSources]
  );
  const crawl4AiDemoAllowed = Boolean(
    crawl4AiDemoSource?.is_enabled &&
      crawl4AiDemoSource?.trust_status === "approved"
  );

  useEffect(() => {
    fetchRecruiters();
    fetchExternalJobs();
    fetchExternalSources();
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

      if (!token) {
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

  const fetchExternalSources = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setExternalSourcesLoading(false);
        return;
      }

      setExternalSourcesLoading(true);
      const response = await getExternalSources(token);
      const rows = response.data.externalSources || [];

      setExternalSources(rows);
      setSourceNotes(
        rows.reduce((notes, source) => {
          notes[source.external_source_id] = source.notes || "";
          return notes;
        }, {})
      );
    } catch (requestError) {
      console.log(
        "ADMIN EXTERNAL SOURCE FETCH ERROR:",
        requestError.response?.data || requestError.message
      );
      setSourceError(
        requestError.response?.data?.error ||
          "Unable to fetch external discovery sources"
      );
    } finally {
      setExternalSourcesLoading(false);
    }
  };

  const handleExternalSourceFormChange = (event) => {
    const { name, value } = event.target;

    setExternalSourceForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const handleCreateExternalSource = async (event) => {
    event.preventDefault();

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setSourceError("Please sign in again to create a source.");
        return;
      }

      setSourceCreating(true);
      setSourceMessage("");
      setSourceError("");

      const response = await createExternalSource(token, externalSourceForm);

      setExternalSourceForm(emptyExternalSourceForm);
      setSourceMessage(
        response.data.message || "External discovery source created."
      );
      await fetchExternalSources();
    } catch (requestError) {
      console.log(
        "ADMIN EXTERNAL SOURCE CREATE ERROR:",
        requestError.response?.data || requestError.message
      );
      setSourceError(
        requestError.response?.data?.error ||
          "Unable to create external discovery source"
      );
    } finally {
      setSourceCreating(false);
    }
  };

  const handleExternalSourceUpdate = async (sourceId, updates) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setSourceError("Please sign in again to update this source.");
        return;
      }

      setBusySourceId(sourceId);
      setSourceMessage("");
      setSourceError("");

      const response = await updateExternalSource(token, sourceId, updates);
      const updatedSource = response.data.externalSource;

      setExternalSources((currentSources) =>
        currentSources.map((source) =>
          source.external_source_id === sourceId ? updatedSource : source
        )
      );
      setSourceNotes((currentNotes) => ({
        ...currentNotes,
        [sourceId]: updatedSource.notes || "",
      }));
      setSourceMessage(
        response.data.message || "External discovery source updated."
      );
    } catch (requestError) {
      console.log(
        "ADMIN EXTERNAL SOURCE UPDATE ERROR:",
        requestError.response?.data || requestError.message
      );
      setSourceError(
        requestError.response?.data?.error ||
          "Unable to update external discovery source"
      );
    } finally {
      setBusySourceId(null);
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

  const handleRunCrawl4AiDemoDiscovery = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setDiscoveryError("Please sign in again to run discovery.");
        return;
      }

      if (!crawl4AiDemoAllowed) {
        setDiscoveryError(
          "Crawl4AI demo discovery source is disabled or not approved."
        );
        return;
      }

      setDiscoveryLoading(true);
      setDiscoveryMessage("");
      setDiscoveryError("");

      const response = await runCrawl4AiDemoDiscovery(token);
      const result = response.data || {};

      if (!result.success) {
        throw new Error(
          result.message || "Unable to run Crawl4AI demo discovery"
        );
      }

      await fetchExternalJobs();
      setDiscoveryMessage(
        `Crawl4AI demo discovery completed. Discovered: ${
          result.discovered_count ?? 0
        }; inserted: ${result.inserted_count ?? 0}; updated: ${
          result.updated_count ?? 0
        }.`
      );
    } catch (requestError) {
      console.log(
        "ADMIN CRAWL4AI DEMO DISCOVERY ERROR:",
        requestError.response?.data || requestError.message
      );
      setDiscoveryError(
        requestError.response?.data?.message ||
          requestError.response?.data?.error ||
          requestError.message ||
          "Unable to run Crawl4AI demo discovery"
      );
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    setMessage("");
    await Promise.all([
      fetchRecruiters(),
      fetchExternalJobs(),
      fetchExternalSources(),
    ]);
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

      <section className="panel admin-external-sources-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Source Governance</p>
            <h2>External Sources</h2>
            <p className="muted">
              Approve and enable a source before any discovery operation can use
              it.
            </p>
          </div>
          <span className="count-pill">{externalSources.length}</span>
        </div>

        <form
          className="admin-source-create-form"
          onSubmit={handleCreateExternalSource}
        >
          <div className="admin-source-form-heading">
            <div>
              <h3>Add external source</h3>
              <p>
                New sources start disabled and pending until an admin explicitly
                approves and enables them.
              </p>
            </div>
          </div>

          <div className="admin-source-form-grid">
            <label>
              Source name
              <input
                type="text"
                name="source_name"
                value={externalSourceForm.source_name}
                onChange={handleExternalSourceFormChange}
                placeholder="Example Company Careers"
                required
              />
            </label>
            <label>
              Source key
              <input
                type="text"
                name="source_key"
                value={externalSourceForm.source_key}
                onChange={handleExternalSourceFormChange}
                placeholder="example_company_careers"
                pattern="[a-z0-9][a-z0-9_-]*"
                required
              />
            </label>
            <label>
              Source type
              <select
                name="source_type"
                value={externalSourceForm.source_type}
                onChange={handleExternalSourceFormChange}
              >
                {externalSourceTypes.map((sourceType) => (
                  <option value={sourceType.value} key={sourceType.value}>
                    {sourceType.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Safety mode
              <input
                type="text"
                name="safety_mode"
                value={externalSourceForm.safety_mode}
                onChange={handleExternalSourceFormChange}
                placeholder="manual_review"
              />
            </label>
            <label className="admin-source-form-wide">
              Base URL or source reference
              <input
                type="text"
                name="base_url"
                value={externalSourceForm.base_url}
                onChange={handleExternalSourceFormChange}
                placeholder="Optional; adding a source does not contact this URL"
              />
            </label>
            <label className="admin-source-form-wide">
              Notes
              <textarea
                name="notes"
                value={externalSourceForm.notes}
                onChange={handleExternalSourceFormChange}
                placeholder="Internal safety and review notes"
                rows="3"
              />
            </label>
          </div>

          <button
            type="submit"
            className="primary-button"
            disabled={sourceCreating}
          >
            {sourceCreating ? "Creating Source..." : "Create Source"}
          </button>
        </form>

        {sourceMessage && (
          <div className="notice-banner compact" role="status">
            {sourceMessage}
          </div>
        )}
        {sourceError && (
          <div
            className="notice-banner compact admin-error-notice"
            role="alert"
          >
            {sourceError}
          </div>
        )}

        {externalSourcesLoading ? (
          <p className="empty-state">Loading external sources...</p>
        ) : externalSources.length === 0 ? (
          <p className="empty-state">No external discovery sources found.</p>
        ) : (
          <div className="admin-source-list">
            {externalSources.map((source) => {
              const isCrawl4AiDemo = source.source_key === "crawl4ai_demo";
              const sourceBusy = busySourceId === source.external_source_id;

              return (
                <article
                  className={`admin-source-card ${
                    isCrawl4AiDemo ? "safe-demo-source" : ""
                  }`}
                  key={source.external_source_id}
                >
                  <div className="admin-source-card-header">
                    <div>
                      <div className="admin-source-badges">
                        <span className={statusClass(source.trust_status)}>
                          {source.trust_status}
                        </span>
                        <span
                          className={`status-badge ${
                            source.is_enabled
                              ? "status-approved"
                              : "status-hidden"
                          }`}
                        >
                          {source.is_enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <h3>{source.source_name}</h3>
                      <code>{source.source_key}</code>
                    </div>
                    <div className="admin-recruiter-date">
                      <span>Updated</span>
                      <strong>{formatCreatedDate(source.updated_at)}</strong>
                    </div>
                  </div>

                  <div className="admin-source-meta">
                    <span>
                      {String(source.source_type || "Not specified").replace(
                        /_/g,
                        " "
                      )}
                    </span>
                    <span>
                      Safety: {String(source.safety_mode || "manual_review").replace(
                        /_/g,
                        " "
                      )}
                    </span>
                  </div>

                  {source.base_url && (
                    <p className="admin-source-reference">
                      <strong>Reference:</strong> {source.base_url}
                    </p>
                  )}

                  {isCrawl4AiDemo && (
                    <div className="admin-safe-source-note">
                      <strong>Safe raw local demo HTML only</strong>
                      <span>No external website contacted.</span>
                    </div>
                  )}

                  <label className="admin-review-notes">
                    Notes
                    <textarea
                      value={sourceNotes[source.external_source_id] || ""}
                      onChange={(event) =>
                        setSourceNotes((currentNotes) => ({
                          ...currentNotes,
                          [source.external_source_id]: event.target.value,
                        }))
                      }
                      placeholder="Internal source notes"
                      rows="3"
                    />
                  </label>

                  <div className="admin-source-actions">
                    <button
                      type="button"
                      className="primary-button small-button"
                      onClick={() =>
                        handleExternalSourceUpdate(source.external_source_id, {
                          is_enabled: true,
                        })
                      }
                      disabled={sourceBusy || source.is_enabled}
                    >
                      Enable
                    </button>
                    <button
                      type="button"
                      className="secondary-button small-button"
                      onClick={() =>
                        handleExternalSourceUpdate(source.external_source_id, {
                          is_enabled: false,
                        })
                      }
                      disabled={sourceBusy || !source.is_enabled}
                    >
                      Disable
                    </button>
                    <button
                      type="button"
                      className="primary-button small-button"
                      onClick={() =>
                        handleExternalSourceUpdate(source.external_source_id, {
                          trust_status: "approved",
                        })
                      }
                      disabled={sourceBusy || source.trust_status === "approved"}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="danger-button small-button"
                      onClick={() =>
                        handleExternalSourceUpdate(source.external_source_id, {
                          trust_status: "blocked",
                        })
                      }
                      disabled={sourceBusy || source.trust_status === "blocked"}
                    >
                      Block
                    </button>
                    <button
                      type="button"
                      className="secondary-button small-button"
                      onClick={() =>
                        handleExternalSourceUpdate(source.external_source_id, {
                          notes: sourceNotes[source.external_source_id] || null,
                        })
                      }
                      disabled={sourceBusy}
                    >
                      {sourceBusy ? "Updating..." : "Save Notes"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {process.env.NODE_ENV !== "production" && (
        <section className="panel admin-discovery-operations-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Discovery Operations</p>
              <h2>External Job Discovery</h2>
              <p className="muted">
                Run the controlled demo source, then review newly discovered jobs
                before approving candidate access.
              </p>
            </div>
          </div>

          <div className="admin-discovery-operation">
            <div>
              <strong>Crawl4AI demo discovery</strong>
              <p>
                {externalSourcesLoading
                  ? "Checking source allowlist..."
                  : crawl4AiDemoAllowed
                  ? "Safe raw local demo HTML only. No external website is contacted."
                  : "Crawl4AI demo discovery source is disabled or not approved."}
              </p>
            </div>
            <button
              type="button"
              className="primary-button"
              onClick={handleRunCrawl4AiDemoDiscovery}
              disabled={
                discoveryLoading ||
                externalSourcesLoading ||
                !crawl4AiDemoAllowed
              }
            >
              {discoveryLoading
                ? "Running Demo Discovery..."
                : "Run Crawl4AI Demo Discovery"}
            </button>
          </div>

          {discoveryMessage && (
            <div className="notice-banner compact" role="status">
              {discoveryMessage}
            </div>
          )}
          {discoveryError && (
            <div
              className="notice-banner compact admin-error-notice"
              role="alert"
            >
              {discoveryError}
            </div>
          )}
        </section>
      )}

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
