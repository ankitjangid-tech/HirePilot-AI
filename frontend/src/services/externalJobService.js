import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

const authHeader = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export const getMatchedExternalJobs = (token) => {
  return API.get("/external-jobs/matched", authHeader(token));
};

export const getExternalApplications = (token) => {
  return API.get("/external-jobs/my-applications", authHeader(token));
};

export const getExternalAgentLogs = (token) => {
  return API.get("/external-jobs/agent-logs", authHeader(token));
};

export const applyExternalJob = (token, externalJobId) => {
  return API.post(
    "/external-jobs/apply",
    {
      external_job_id: externalJobId,
    },
    authHeader(token)
  );
};

export const completeExternalApplication = (token, externalApplicationId) => {
  return API.put(
    "/external-jobs/complete",
    {
      external_application_id: externalApplicationId,
    },
    authHeader(token)
  );
};
