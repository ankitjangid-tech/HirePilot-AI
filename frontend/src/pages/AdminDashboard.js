import { useEffect, useMemo, useState } from "react";
import "../App.css";

import {
  getRecruiters,
  updateRecruiterStatus,
  getExternalJobsForReview,
  getExternalSources,
  createExternalSource,
  updateExternalSource,
  getRecruiterCompanies,
  updateCompanyVerification,
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

const adminTabs = [
  { id: "overview", label: "Overview" },
  { id: "recruiters", label: "Recruiters" },
  { id: "company-verification", label: "Company Verification" },
  { id: "external-sources", label: "External Sources" },
  { id: "discovery", label: "Discovery" },
  { id: "external-job-review", label: "External Job Review" },
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

const safeCompanyWebsite = (value) => {
  if (!value) {
    return null;
  }

  const candidateUrl = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const parsedUrl = new URL(candidateUrl);
    return ["http:", "https:"].includes(parsedUrl.protocol)
      ? parsedUrl.toString()
      : null;
  } catch (error) {
    return null;
  }
};

const reviewStatusLabel = (status) =>
  status === "pending_review"
    ? "Pending review"
    : String(status || "approved").replace(/_/g, " ");

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
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
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [busyCompanyId, setBusyCompanyId] = useState(null);
  const [savingCompanyNotesId, setSavingCompanyNotesId] = useState(null);
  const [companyNotes, setCompanyNotes] = useState({});
  const [companyNotesFeedback, setCompanyNotesFeedback] = useState({});
  const [companyMessage, setCompanyMessage] = useState("");
  const [companyError, setCompanyError] = useState("");

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

  const companyVerificationCounts = useMemo(
    () =>
      companies.reduce(
        (counts, company) => {
          const status = company.verification_status || "pending";
          counts[status] = (counts[status] || 0) + 1;
          return counts;
        },
        { pending: 0, verified: 0, rejected: 0, needs_review: 0 }
      ),
    [companies]
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
  const crawl4AiDemoAvailable = process.env.NODE_ENV !== "production";

  useEffect(() => {
    fetchRecruiters();
    fetchExternalJobs();
    fetchExternalSources();
    fetchCompanies();
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

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setCompaniesLoading(false);
        return;
      }

      setCompaniesLoading(true);
      const response = await getRecruiterCompanies(token);
      const rows = response.data.companies || [];

      setCompanies(rows);
      setCompanyNotes(
        rows.reduce((notes, company) => {
          notes[company.company_id] = company.verification_notes || "";
          return notes;
        }, {})
      );
      setCompanyError("");
    } catch (requestError) {
      console.log(
        "ADMIN COMPANY FETCH ERROR:",
        requestError.response?.data || requestError.message
      );
      setCompanyError(
        requestError.response?.data?.error ||
          "Unable to fetch recruiter company profiles"
      );
    } finally {
      setCompaniesLoading(false);
    }
  };

  const handleCompanyVerification = async (
    companyId,
    verificationStatus,
    notes = undefined
  ) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setCompanyError("Please sign in again to review this company.");
        return;
      }

      setBusyCompanyId(companyId);
      setCompanyNotesFeedback((currentFeedback) => ({
        ...currentFeedback,
        [companyId]: null,
      }));
      setCompanyMessage("");
      setCompanyError("");

      const response = await updateCompanyVerification(
        token,
        companyId,
        verificationStatus,
        notes
      );
      const updatedCompany = response.data.company;

      setCompanies((currentCompanies) =>
        currentCompanies.map((company) =>
          company.company_id === companyId
            ? { ...company, ...updatedCompany }
            : company
        )
      );
      setCompanyNotes((currentNotes) => ({
        ...currentNotes,
        [companyId]: updatedCompany.verification_notes || "",
      }));
      setCompanyMessage(
        response.data.message || "Company verification updated."
      );
    } catch (requestError) {
      console.log(
        "ADMIN COMPANY VERIFICATION ERROR:",
        requestError.response?.data || requestError.message
      );
      setCompanyError(
        requestError.response?.data?.error ||
          "Unable to update company verification"
      );
    } finally {
      setBusyCompanyId(null);
    }
  };

  const handleSaveCompanyNotes = async (companyId) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setCompanyNotesFeedback((currentFeedback) => ({
          ...currentFeedback,
          [companyId]: {
            type: "error",
            message: "Please sign in again to save company verification notes.",
          },
        }));
        return;
      }

      setSavingCompanyNotesId(companyId);
      setCompanyNotesFeedback((currentFeedback) => ({
        ...currentFeedback,
        [companyId]: null,
      }));

      await updateCompanyVerification(
        token,
        companyId,
        undefined,
        companyNotes[companyId] || ""
      );
      await fetchCompanies();

      setCompanyNotesFeedback((currentFeedback) => ({
        ...currentFeedback,
        [companyId]: {
          type: "success",
          message: "Company verification notes saved.",
        },
      }));
    } catch (requestError) {
      console.log(
        "ADMIN COMPANY NOTES SAVE ERROR:",
        requestError.response?.data || requestError.message
      );
      setCompanyNotesFeedback((currentFeedback) => ({
        ...currentFeedback,
        [companyId]: {
          type: "error",
          message:
            requestError.response?.data?.error ||
            "Unable to save company verification notes.",
        },
      }));
    } finally {
      setSavingCompanyNotesId(null);
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
      fetchCompanies(),
    ]);
    setRefreshing(false);
  };

  const handleAdminTabKeyDown = (event, tabIndex) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();

    let nextIndex = tabIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (tabIndex + 1) % adminTabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (tabIndex - 1 + adminTabs.length) % adminTabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = adminTabs.length - 1;
    }

    const nextTab = adminTabs[nextIndex];
    setActiveTab(nextTab.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`admin-tab-${nextTab.id}`)?.focus();
    });
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

      <nav className="admin-tab-shell" aria-label="Admin control panel">
        <div className="admin-tab-list" role="tablist">
          {adminTabs.map((tab, tabIndex) => (
            <button
              type="button"
              role="tab"
              id={`admin-tab-${tab.id}`}
              className={`admin-tab-button ${
                activeTab === tab.id ? "active" : ""
              }`}
              aria-selected={activeTab === tab.id}
              aria-controls={`admin-tabpanel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleAdminTabKeyDown(event, tabIndex)}
              key={tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {activeTab === "overview" && (
        <section
          className="panel admin-overview-panel"
          id="admin-tabpanel-overview"
          role="tabpanel"
          aria-labelledby="admin-tab-overview"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">Control Panel Overview</p>
              <h2>Platform Administration</h2>
              <p className="muted">
                Monitor recruiter access, discovery governance, and external job
                moderation from one place.
              </p>
            </div>
          </div>

          <div className="admin-overview-group">
            <h3>Recruiter access</h3>
            <div className="admin-summary-grid" aria-label="Recruiter summary">
              <article>
                <span>Total recruiters</span>
                <strong>{recruiters.length}</strong>
              </article>
              <article className="pending">
                <span>Pending recruiters</span>
                <strong>{statusCounts.pending}</strong>
              </article>
              <article className="approved">
                <span>Approved recruiters</span>
                <strong>{statusCounts.approved}</strong>
              </article>
              <article className="blocked">
                <span>Blocked recruiters</span>
                <strong>{statusCounts.blocked}</strong>
              </article>
            </div>
          </div>

          <div className="admin-overview-group">
            <h3>Company verification</h3>
            <div
              className="admin-summary-grid"
              aria-label="Company verification summary"
            >
              <article className="pending">
                <span>Pending companies</span>
                <strong>{companyVerificationCounts.pending}</strong>
              </article>
              <article className="approved">
                <span>Verified companies</span>
                <strong>{companyVerificationCounts.verified}</strong>
              </article>
              <article className="blocked">
                <span>Rejected companies</span>
                <strong>{companyVerificationCounts.rejected}</strong>
              </article>
              <article className="pending">
                <span>Needs review</span>
                <strong>{companyVerificationCounts.needs_review}</strong>
              </article>
            </div>
          </div>

          <div className="admin-overview-group">
            <h3>External discovery governance</h3>
            <div
              className="admin-summary-grid admin-governance-summary-grid"
              aria-label="External discovery summary"
            >
              <article>
                <span>External sources</span>
                <strong>{externalSources.length}</strong>
              </article>
              <article className="pending">
                <span>Jobs pending review</span>
                <strong>{reviewCounts.pending_review}</strong>
              </article>
              <article className="approved">
                <span>Approved jobs</span>
                <strong>{reviewCounts.approved}</strong>
              </article>
              <article className="hidden">
                <span>Hidden jobs</span>
                <strong>{reviewCounts.hidden}</strong>
              </article>
              <article className="blocked">
                <span>Rejected jobs</span>
                <strong>{reviewCounts.rejected}</strong>
              </article>
            </div>
          </div>
        </section>
      )}

      {message && <div className="notice-banner">{message}</div>}
      {error && <div className="notice-banner admin-error-notice">{error}</div>}

      {activeTab === "recruiters" && (
      <section
        className="panel admin-recruiter-panel"
        id="admin-tabpanel-recruiters"
        role="tabpanel"
        aria-labelledby="admin-tab-recruiters"
      >
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
      )}

      {activeTab === "company-verification" && (
        <section
          className="panel admin-company-verification-panel"
          id="admin-tabpanel-company-verification"
          role="tabpanel"
          aria-labelledby="admin-tab-company-verification"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">Employer Trust</p>
              <h2>Company Verification</h2>
              <p className="muted">
                Review recruiter company profiles before HirePilot treats them
                as verified employers.
              </p>
            </div>
            <span className="count-pill">{companies.length}</span>
          </div>

          {companyMessage && (
            <div className="notice-banner compact" role="status">
              {companyMessage}
            </div>
          )}
          {companyError && (
            <div
              className="notice-banner compact admin-error-notice"
              role="alert"
            >
              {companyError}
            </div>
          )}

          {companiesLoading ? (
            <p className="empty-state">Loading company profiles...</p>
          ) : companies.length === 0 ? (
            <p className="empty-state">
              No recruiter company profiles have been submitted.
            </p>
          ) : (
            <div className="admin-company-list">
              {companies.map((company) => {
                const companyVerificationBusy =
                  busyCompanyId === company.company_id;
                const companyNotesSaving =
                  savingCompanyNotesId === company.company_id;
                const companyBusy =
                  companyVerificationBusy || companyNotesSaving;
                const notesFeedback =
                  companyNotesFeedback[company.company_id];
                const websiteUrl = safeCompanyWebsite(company.company_website);

                return (
                  <article
                    className="admin-company-card"
                    key={company.company_id}
                  >
                    <div className="admin-company-card-header">
                      <div>
                        <span className={statusClass(company.verification_status)}>
                          {String(
                            company.verification_status || "pending"
                          ).replace(/_/g, " ")}
                        </span>
                        <h3>{company.company_name}</h3>
                        <p>
                          {company.recruiter_name || "Recruiter"} · {company.recruiter_email}
                        </p>
                      </div>
                      <div className="admin-recruiter-date">
                        <span>Updated</span>
                        <strong>{formatCreatedDate(company.updated_at)}</strong>
                      </div>
                    </div>

                    <div className="admin-company-meta">
                      <span>{company.industry || "Industry not added"}</span>
                      <span>{company.company_size || "Size not added"}</span>
                      <span>
                        {company.headquarters_location || "Location not added"}
                      </span>
                    </div>

                    <div className="admin-company-details">
                      <div>
                        <span>Website</span>
                        {websiteUrl ? (
                          <a href={websiteUrl} target="_blank" rel="noreferrer">
                            {company.company_website}
                          </a>
                        ) : (
                          <strong>{company.company_website || "Not added"}</strong>
                        )}
                      </div>
                      <div>
                        <span>Description</span>
                        <p>{company.company_description || "Not added"}</p>
                      </div>
                    </div>

                    <label className="admin-review-notes">
                      Verification notes
                      <textarea
                        value={companyNotes[company.company_id] || ""}
                        onChange={(event) =>
                          setCompanyNotes((currentNotes) => ({
                            ...currentNotes,
                            [company.company_id]: event.target.value,
                          }))
                        }
                        placeholder="Internal verification notes shared with the recruiter"
                        rows="3"
                      />
                    </label>

                    <div className="admin-company-actions">
                      <button
                        type="button"
                        className="primary-button small-button"
                        onClick={() =>
                          handleCompanyVerification(
                            company.company_id,
                            "verified",
                            companyNotes[company.company_id]
                          )
                        }
                        disabled={
                          companyBusy || company.verification_status === "verified"
                        }
                      >
                        Verify
                      </button>
                      <button
                        type="button"
                        className="danger-button small-button"
                        onClick={() =>
                          handleCompanyVerification(
                            company.company_id,
                            "rejected",
                            companyNotes[company.company_id]
                          )
                        }
                        disabled={
                          companyBusy || company.verification_status === "rejected"
                        }
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() =>
                          handleCompanyVerification(
                            company.company_id,
                            "needs_review",
                            companyNotes[company.company_id]
                          )
                        }
                        disabled={
                          companyBusy ||
                          company.verification_status === "needs_review"
                        }
                      >
                        Mark Needs Review
                      </button>
                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() =>
                          handleCompanyVerification(
                            company.company_id,
                            "pending",
                            companyNotes[company.company_id]
                          )
                        }
                        disabled={
                          companyBusy || company.verification_status === "pending"
                        }
                      >
                        Mark Pending
                      </button>
                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() =>
                          handleSaveCompanyNotes(company.company_id)
                        }
                        disabled={companyBusy}
                      >
                        {companyNotesSaving ? "Saving Notes..." : "Save Notes"}
                      </button>
                    </div>
                    {notesFeedback && (
                      <div
                        className={`notice-banner compact${
                          notesFeedback.type === "error"
                            ? " admin-error-notice"
                            : ""
                        }`}
                        role={
                          notesFeedback.type === "error" ? "alert" : "status"
                        }
                      >
                        {notesFeedback.message}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeTab === "external-sources" && (
      <section
        className="panel admin-external-sources-panel"
        id="admin-tabpanel-external-sources"
        role="tabpanel"
        aria-labelledby="admin-tab-external-sources"
      >
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
      )}

      {activeTab === "discovery" && (
        <section
          className="panel admin-discovery-operations-panel"
          id="admin-tabpanel-discovery"
          role="tabpanel"
          aria-labelledby="admin-tab-discovery"
        >
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
                {!crawl4AiDemoAvailable
                  ? "Safe demo discovery is available only in development mode."
                  : externalSourcesLoading
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
                !crawl4AiDemoAvailable ||
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

      {activeTab === "external-job-review" && (
      <section
        className="panel admin-external-review-panel"
        id="admin-tabpanel-external-job-review"
        role="tabpanel"
        aria-labelledby="admin-tab-external-job-review"
      >
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
      )}
    </main>
  );
}

export default AdminDashboard;
