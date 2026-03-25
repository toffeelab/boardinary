export const SYSTEM_USER_ID = "system";
export const DEFAULT_USER_ID = "local-user";

export const AUTH_ROUTES = {
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  API_AUTH: "/api/auth",
} as const;

export const ORG_ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
} as const;
