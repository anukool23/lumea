import { create } from "zustand";
import type { User } from "../lib/auth";
import { clearToken, setToken, setStoredUser, getStoredUser, getToken } from "../lib/auth";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  hydrate: () => {
    const token = getToken();
    const user = getStoredUser();
    set({ token, user, isAuthenticated: !!token && !!user, isLoading: false });
  },

  login: (token, user) => {
    setToken(token);
    setStoredUser(user);
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    clearToken();
    set({ token: null, user: null, isAuthenticated: false });
  },

  updateUser: (updates) =>
    set((state) => {
      if (!state.user) return {};
      const updated = { ...state.user, ...updates };
      setStoredUser(updated);
      return { user: updated };
    }),
}));
