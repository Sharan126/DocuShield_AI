import { create } from "zustand";

export interface User {
  id: number;
  username: string;
  role: string;
  name?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
}

const getInitialState = () => {
  if (typeof window === "undefined") {
    return { token: null, user: null };
  }
  
  const token = localStorage.getItem("token");
  const userStr = localStorage.getItem("user");
  let user: User | null = null;
  
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch (e) {
      console.error("Failed to parse user from localStorage", e);
    }
  }
  
  return { token, user };
};

export const useAuthStore = create<AuthState>((set) => ({
  ...getInitialState(),
  
  setAuth: (token, user) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      
      // Set token in document cookie for middleware access
      document.cookie = `token=${token}; path=/; max-age=3600; SameSite=Strict; Secure`;
    }
    set({ token, user });
  },
  
  clearAuth: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      
      // Clear token cookie
      document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
    set({ token: null, user: null });
  }
}));
