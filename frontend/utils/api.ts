// file: utils/api.ts or wherever you define Axios
import axios from "axios";
import { getToken, clearToken } from "../hooks/useAuth";
import Router from "next/router";
import { useToast } from "./toast";

const toast = useToast();
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Global error handling
api.interceptors.response.use(
  (res) => res,
  (error) => {
    console.log("❌ API Error:", error);
    if (!error.response) {
      // ❌ Network error (offline, DNS, timeout)
      toast.error("Network not available. Please check your connection.");
    } else if (error.response.status === 401 && error.response.data.detail !== "Invalid credentials") {
      // ❌ Unauthorized
      toast.error("Session expired. Please log in again.");
      clearToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;