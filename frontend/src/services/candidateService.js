import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

export const getProfile = (token) => {
  return API.get("/profile/status", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const updateProfile = (token, profileData) => {
  return API.put("/profile/update", profileData, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
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
