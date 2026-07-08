import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

const authHeaders = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export const getProfile = (token) => {
  return API.get("/profile/status", authHeaders(token));
};

export const updateProfile = (token, profileData) => {
  return API.put("/profile/update", profileData, authHeaders(token));
};

export const uploadResume = (token, resumeFile) => {
  const formData = new FormData();

  formData.append("resume", resumeFile);

  return API.post("/resume/upload", formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  });
};

export const viewMyResume = (token) => {
  return API.get("/resume/my-resume", {
    ...authHeaders(token),
    responseType: "blob",
  });
};

export const downloadMyResume = (token) => {
  return API.get("/resume/my-resume/download", {
    ...authHeaders(token),
    responseType: "blob",
  });
};
