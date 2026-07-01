import { create } from "zustand";

interface AdminUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: AdminUser | null;
  token: string | null;
  setUser: (user: AdminUser, token: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  setUser: (user, token) => {
    sessionStorage.setItem("admin_token", token);
    sessionStorage.setItem("admin_user", JSON.stringify(user));
    set({ user, token });
  },
  logout: () => {
    sessionStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_user");
    set({ user: null, token: null });
  },
  hydrate: () => {
    const token = sessionStorage.getItem("admin_token");
    const raw = sessionStorage.getItem("admin_user");
    if (token && raw) {
      try {
        const user = JSON.parse(raw) as AdminUser;
        set({ user, token });
      } catch {
        // ignore
      }
    }
  },
}));
