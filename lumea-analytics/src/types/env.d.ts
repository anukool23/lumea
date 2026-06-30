export interface JWTPayload {
  user_id: string;
  email: string;
  username: string;
  role: string;
  plan: string;
  is_partner: boolean;
  jti: string;
  exp: number;
  iat: number;
}

export interface HonoVariables {
  user: JWTPayload;
}

export type AppEnv = {
  Variables: HonoVariables;
};
