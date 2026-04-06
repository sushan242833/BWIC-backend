export const appConfig = {
  server: {
    trustProxyHops: 1,
  },
  geocoding: {
    provider: "nominatim" as const,
    userAgent: "bluewhale-investment-backend/1.0",
    timeoutMs: 4000,
    language: "en",
    geocodeLimit: 1,
    autocompleteLimit: 5,
    minimumQueryLength: 2,
    countryCodes: "np",
  },
} as const;

export default appConfig;
