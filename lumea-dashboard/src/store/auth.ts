import { create } from "zustand";

export interface DashUser {
  id: string; email: string; username: string; name?: string;
  profile_picture?: string; role: string; supporter_status: string;
  is_partner: boolean; ink_score: number; followers_count: number;
}

interface AuthState {
  user: DashUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: DashUser) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null, token: null, isLoading: true, isAuthenticated: false,

  hydrate: () => {
    const token = localStorage.getItem("lumea_token");
    const raw = localStorage.getItem("lumea_user");
    const user = raw ? JSON.parse(raw) : null;
    set({ token, user, isAuthenticated: !!token && !!user, isLoading: false });
  },

  login: (token, user) => {
    localStorage.setItem("lumea_token", token);
    localStorage.setItem("lumea_user", JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem("lumea_token");
    localStorage.removeItem("lumea_user");
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
