import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

export const getApplications = (token) => {
  return API.get("/applications/my-applications", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const getPendingApplications = (token) => {
  return API.get("/pending-applications", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const completePendingApplication = (token, applicationId) => {
  return API.put(
    "/pending-applications/complete",
    {
      application_id: applicationId,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};