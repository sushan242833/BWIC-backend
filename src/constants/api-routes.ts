export const API_BASE_PATH = "/api";

const withApiBasePath = (path: string): string => `${API_BASE_PATH}${path}`;

export const API_ROUTES = {
  auth: withApiBasePath("/auth"),
  properties: withApiBasePath("/properties"),
  recommendations: withApiBasePath("/recommendations"),
  categories: withApiBasePath("/categories"),
  locations: withApiBasePath("/locations"),
  contacts: withApiBasePath("/contacts"),
  stats: withApiBasePath("/stats"),
} as const;
