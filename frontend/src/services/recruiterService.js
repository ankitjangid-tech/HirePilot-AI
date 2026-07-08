import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

const authHeaders = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export const getMyJobs = (token) => {
  return API.get("/recruiter/my-jobs", authHeaders(token));
};

export const getApplicants = (jobId, token) => {
  return API.get(`/recruiter-ranking/${jobId}`, authHeaders(token));
};

export const updateStatus = (data, token) => {
  return API.put("/application-status/update", data, authHeaders(token));
};

export const scheduleInterview = (data, token) => {
  return API.post("/interviews/schedule", data, authHeaders(token));
};

export const viewApplicantResume = (applicationId, token) => {
  return API.get(`/resume/applicant/${applicationId}`, {
    ...authHeaders(token),
    responseType: "blob",
  });
};

export const downloadApplicantResume = (applicationId, token) => {
  return API.get(`/resume/applicant/${applicationId}/download`, {
    ...authHeaders(token),
    responseType: "blob",
  });
};
