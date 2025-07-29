export const getToken = () => typeof window !== 'undefined' ? localStorage.getItem("token") : null;
export const setToken = (token: string) => localStorage.setItem("token", token);
export const clearToken = () => localStorage.removeItem("token");


import { useEffect, useState } from "react";
import api from "../utils/api"; // your axios wrapper

export const useAuth = () => {
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const token = getToken();
      if (!token) return;

      try {
        const res = await api.get("/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(res.data);
      } catch (err) {
        console.error("❌ Failed to load user", err);
        setUser(null);
      }
    };

    fetchUser();
  }, []);

  return { user };
};
