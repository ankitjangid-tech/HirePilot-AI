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

export const runCrawl4AiDemoDiscovery = (token) => {
  return API.post(
    "/admin/discovery/crawl4ai-demo",
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
