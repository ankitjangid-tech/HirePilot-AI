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
