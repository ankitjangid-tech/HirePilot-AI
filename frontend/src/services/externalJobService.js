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

export const getExternalAgentRuns = (token) => {
  return API.get("/external-jobs/agent-runs", authHeader(token));
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

export const getExternalWorkerHealth = (token) => {
  return API.get("/external-jobs/worker-health", authHeader(token));
};

export const retryExternalAgentRun = (token, agentRunId) => {
  return API.post(
    `/external-jobs/agent-runs/${agentRunId}/retry`,
    {},
    authHeader(token)
  );
};

export const cancelExternalAgentRun = (token, agentRunId) => {
  return API.put(
    `/external-jobs/agent-runs/${agentRunId}/cancel`,
    {},
    authHeader(token)
  );
};

export const runSafeBrowserSmokeTest = (token) => {
  return API.post(
    "/external-jobs/browser/smoke-test",
    {},
    authHeader(token)
  );
};

export const resetSafeDummyExternalApplication = (token) => {
  return API.delete(
    "/external-jobs/safe-dummy/reset",
    authHeader(token)
  );
};

export const runCrawl4AiDemoDiscovery = (token) => {
  return API.post(
    "/external-jobs/discovery/crawl4ai-demo",
    {},
    authHeader(token)
  );
};
