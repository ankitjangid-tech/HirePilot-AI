import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

const authHeaders = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export const getRecruiters = (token) => {
  return API.get("/admin/recruiters", authHeaders(token));
};

export const updateRecruiterStatus = (token, userId, recruiterStatus) => {
  return API.patch(
    `/admin/recruiters/${userId}/status`,
    {
      recruiter_status: recruiterStatus,
      recruiter_status_reason:
        recruiterStatus === "blocked"
          ? "Blocked by platform administrator."
          : null,
    },
    authHeaders(token)
  );
};

export const getExternalJobsForReview = (token) => {
  return API.get("/admin/external-jobs", authHeaders(token));
};

export const getExternalSources = (token) => {
  return API.get("/admin/external-sources", authHeaders(token));
};

export const createExternalSource = (token, source) => {
  return API.post("/admin/external-sources", source, authHeaders(token));
};

export const updateExternalSource = (token, sourceId, updates) => {
  return API.patch(
    `/admin/external-sources/${sourceId}`,
    updates,
    authHeaders(token)
  );
};

export const getExternalSourceCatalog = (token, filters = {}) => {
  return API.get("/admin/external-source-catalog", {
    ...authHeaders(token),
    params: filters,
  });
};

export const importExternalSourceCatalog = (token, catalogId) => {
  return API.post(
    `/admin/external-source-catalog/${catalogId}/import`,
    {},
    authHeaders(token)
  );
};

export const updateExternalSourceAutoDiscovery = (
  token,
  sourceId,
  updates
) => {
  return API.patch(
    `/admin/external-sources/${sourceId}/auto-discovery`,
    updates,
    authHeaders(token)
  );
};

export const getExternalDiscoveryRuns = (token, limit = 100) => {
  return API.get("/admin/external-discovery-runs", {
    ...authHeaders(token),
    params: { limit },
  });
};

export const getRecruiterCompanies = (token) => {
  return API.get("/admin/companies", authHeaders(token));
};

export const updateCompanyVerification = (
  token,
  companyId,
  verificationStatus,
  verificationNotes
) => {
  const payload = {};

  if (verificationStatus !== undefined) {
    payload.verification_status = verificationStatus;
  }

  if (verificationNotes !== undefined) {
    payload.verification_notes = verificationNotes || null;
  }

  return API.patch(
    `/admin/companies/${companyId}/verification`,
    payload,
    authHeaders(token)
  );
};

export const runCrawl4AiDemoDiscovery = (token) => {
  return API.post(
    "/admin/discovery/crawl4ai-demo",
    {},
    authHeaders(token)
  );
};

export const runAllowlistedSourceDiscovery = (token, sourceId) => {
  return API.post(
    `/admin/external-sources/${sourceId}/run-discovery`,
    {},
    authHeaders(token)
  );
};

export const reviewExternalJob = (
  token,
  externalJobId,
  reviewStatus,
  reviewNotes
) => {
  return API.patch(
    `/admin/external-jobs/${externalJobId}/review`,
    {
      review_status: reviewStatus,
      review_notes: reviewNotes || null,
    },
    authHeaders(token)
  );
};
