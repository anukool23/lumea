export interface AppEnv {
  PORT: string;
  NODE_ENV: string;
  MONGODB_URI: string;
  OPENSEARCH_URL: string;
  OPENSEARCH_USERNAME: string;
  OPENSEARCH_PASSWORD: string;
  UPSTASH_REDIS_URL: string;
  UPSTASH_REDIS_TOKEN: string;
  JWT_SECRET: string;
  AUTH_SERVICE_URL: string;
  INTERNAL_SERVICE_TOKEN: string;
}

export interface JWTPayload {
  user_id: string;
  email: string;
  username: string;
  role: string;
  plan: string;        // supporter_status
  is_partner: boolean;
  jti: string;
  exp: number;
  iat: number;
}

export type SupporterPlan =
  | "NONE"
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "LIFETIME"
  | "FOUNDING";

export function isActiveSupporterPlan(plan: string): boolean {
  return ["BRONZE", "SILVER", "GOLD", "PLATINUM", "LIFETIME", "FOUNDING"].includes(plan);
}
