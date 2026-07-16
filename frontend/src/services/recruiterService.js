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

export const getCompanyProfile = (token) => {
  return API.get("/recruiter/company", authHeaders(token));
};

export const saveCompanyProfile = (company, token) => {
  return API.put("/recruiter/company", company, authHeaders(token));
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

export const rescheduleInterview = (interviewId, data, token) => {
  return API.put(`/interviews/${interviewId}/reschedule`, data, authHeaders(token));
};

export const cancelInterview = (interviewId, token) => {
  return API.put(`/interviews/${interviewId}/cancel`, {}, authHeaders(token));
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
