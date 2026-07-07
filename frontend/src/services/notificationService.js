import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

export const getNotifications = (token) => {
  return API.get("/notifications", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const markNotificationRead = (token, notificationId) => {
  return API.put(
    `/notifications/${notificationId}/read`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

export const markAllNotificationsRead = (token) => {
  return API.put(
    "/notifications/mark-all-read",
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

export const cleanupDuplicateNotifications = (token) => {
  return API.delete("/notifications/cleanup-duplicates", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};
