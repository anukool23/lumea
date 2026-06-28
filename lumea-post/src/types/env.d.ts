// JWT payload injected by auth middleware
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

// Hono context variables set by middleware
export interface HonoVariables {
  user: JWTPayload;
}

// App type used in OpenAPIHono constructor
export type AppEnv = { Variables: HonoVariables };
