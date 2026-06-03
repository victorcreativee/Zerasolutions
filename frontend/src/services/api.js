import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5050/api";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("zera_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
