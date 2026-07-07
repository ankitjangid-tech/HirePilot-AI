import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

export const login = (data) => {
  return API.post("/auth/login", data);
};

export const forgotPassword = (email) => {
  return API.post("/auth/forgot-password", { email });
};

export const resetPassword = (token, newPassword) => {
  return API.post("/auth/reset-password", {
    token,
    newPassword,
  });
};
