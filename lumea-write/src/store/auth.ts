import { create } from "zustand";

interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setUser: (user: User, token: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,

  setUser: (user, token) => {
    set({ user, token });
    if (typeof window !== "undefined") {
      sessionStorage.setItem("lumea_user",  JSON.stringify(user));
      sessionStorage.setItem("lumea_token", token);
    }
  },

  logout: () => {
    set({ user: null, token: null });
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("lumea_user");
      sessionStorage.removeItem("lumea_token");
    }
    fetch("/api/proxy/auth/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
  },

  hydrate: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem("lumea_user");
      const tok = sessionStorage.getItem("lumea_token");
      if (raw && tok) set({ user: JSON.parse(raw) as User, token: tok });
    } catch { /* ignore */ }
  },
}));
