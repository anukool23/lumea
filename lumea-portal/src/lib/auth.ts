export interface User {
  id: string;
  email: string;
  username: string;
  name?: string;
  profile_picture?: string;
  role: string;
  supporter_status: string;
  is_partner: boolean;
  ink_score: number;
  followers_count: number;
  following_count: number;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("lumea_token");
}

export function setToken(token: string) {
  localStorage.setItem("lumea_token", token);
}

export function clearToken() {
  localStorage.removeItem("lumea_token");
  localStorage.removeItem("lumea_user");
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("lumea_user");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setStoredUser(user: User) {
  localStorage.setItem("lumea_user", JSON.stringify(user));
}

export function isActiveSupporterPlan(plan: string): boolean {
  return ["BRONZE", "SILVER", "GOLD", "PLATINUM", "LIFETIME", "FOUNDING"].includes(plan);
}

export function getSupporterBadgeColor(plan: string): string {
  const colors: Record<string, string> = {
    BRONZE: "text-amber-600", SILVER: "text-gray-400", GOLD: "text-yellow-500",
    PLATINUM: "text-purple-500", LIFETIME: "text-blue-600", FOUNDING: "text-rose-600",
  };
  return colors[plan] ?? "";
}
