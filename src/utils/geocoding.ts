import https from "https";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface NominatimResult {
  place_id?: number;
  osm_id?: number;
  osm_type?: "node" | "way" | "relation";
  class?: string;
  type?: string;
  addresstype?: string;
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    country?: string;
    country_code?: string;
    state?: string;
    state_district?: string;
    county?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    postcode?: string;
  };
}

const DEFAULT_USER_AGENT = "bluewhale-investment-backend/1.0";
const DEFAULT_NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const DEFAULT_TIMEOUT_MS = 4000;
const DEFAULT_AUTOCOMPLETE_LIMIT = 5;
const DEFAULT_GEOCODE_LIMIT = 1;
const DEFAULT_LANGUAGE = "en";

interface GeocodingConfig {
  provider: "nominatim";
  baseUrl: string;
  userAgent: string;
  timeoutMs: number;
  geocodeLimit: number;
  autocompleteLimit: number;
  language: string;
  countryCodes?: string;
}

const parsePositiveInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const loadGeocodingConfig = (): GeocodingConfig => ({
  provider: "nominatim",
  baseUrl: (
    process.env.GEOCODING_BASE_URL || DEFAULT_NOMINATIM_BASE_URL
  ).trim(),
  userAgent: (process.env.NOMINATIM_USER_AGENT || DEFAULT_USER_AGENT).trim(),
  timeoutMs: parsePositiveInteger(
    process.env.GEOCODING_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  ),
  geocodeLimit: parsePositiveInteger(
    process.env.GEOCODING_GEOCODE_LIMIT,
    DEFAULT_GEOCODE_LIMIT,
  ),
  autocompleteLimit: parsePositiveInteger(
    process.env.GEOCODING_AUTOCOMPLETE_LIMIT,
    DEFAULT_AUTOCOMPLETE_LIMIT,
  ),
  language: (process.env.GEOCODING_LANGUAGE || DEFAULT_LANGUAGE).trim(),
  countryCodes: process.env.GEOCODING_COUNTRY_CODES?.trim() || undefined,
});

const config = loadGeocodingConfig();

const buildNominatimUrl = (query: string, limit: number): URL => {
  const url = new URL("/search", config.baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("accept-language", config.language);
  url.searchParams.set("limit", String(limit));
  if (config.countryCodes) {
    url.searchParams.set("countrycodes", config.countryCodes);
  }
  return url;
};

const buildNominatimLookupUrl = (placeId: string): URL => {
  const url = new URL("/lookup", config.baseUrl);
  url.searchParams.set("place_ids", placeId);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", config.language);
  return url;
};

const nominatimRequest = <T>(url: URL): Promise<T | null> =>
  new Promise<T | null>((resolve) => {
    const request = https.get(
      url,
      {
        headers: {
          // Nominatim requires a descriptive User-Agent for API usage.
          "User-Agent": config.userAgent,
          Accept: "application/json",
        },
      },
      (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          resolve(null);
          res.resume();
          return;
        }

        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            resolve(null);
          }
        });
      },
    );

    request.setTimeout(config.timeoutMs, () => {
      request.destroy();
      resolve(null);
    });
    request.on("error", () => resolve(null));
  });

export const geocodeLocation = async (
  location: string,
): Promise<Coordinates | null> => {
  if (!location.trim()) {
    return null;
  }

  const parsed = await nominatimRequest<NominatimResult[]>(
    buildNominatimUrl(location.trim(), config.geocodeLimit),
  );
  const point = parsed?.[0];
  if (!point) return null;

  const latitude = Number.parseFloat(point.lat || "");
  const longitude = Number.parseFloat(point.lon || "");
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

export interface LocationSuggestion {
  placeId: string;
  description: string;
}

export const autocompleteLocations = async (
  query: string,
): Promise<LocationSuggestion[]> => {
  if (!query.trim()) {
    return [];
  }

  const parsed = await nominatimRequest<NominatimResult[]>(
    buildNominatimUrl(query.trim(), config.autocompleteLimit),
  );
  if (!parsed?.length) return [];

  return parsed
    .map((item) => ({
      placeId: String(item.place_id || ""),
      description: item.display_name || "",
    }))
    .filter((item) => item.placeId && item.description);
};

export interface PlaceDetails {
  id: string;
  primaryText: string;
  secondaryText: string | null;
  fullAddress: string;
  types: string[];
  location: {
    lat: number;
    lng: number;
  };
  address: {
    country: string | null;
    countryCode: string | null;
    state: string | null;
    district: string | null;
    city: string | null;
    postalCode: string | null;
  };
}

const normalizePlaceDetails = (result: NominatimResult): PlaceDetails | null => {
  const lat = Number.parseFloat(result.lat || "");
  const lng = Number.parseFloat(result.lon || "");
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const fullAddress = result.display_name || "";
  if (!fullAddress) return null;

  const primaryText = result.name?.trim() || fullAddress.split(",")[0]?.trim() || "";
  const secondaryText =
    fullAddress.startsWith(`${primaryText},`)
      ? fullAddress.slice(primaryText.length + 1).trim()
      : fullAddress;

  const id =
    String(result.place_id || "") ||
    `${result.osm_type || "place"}:${String(result.osm_id || "")}`;

  const types = Array.from(
    new Set([result.addresstype, result.type, result.class].filter(Boolean)),
  ) as string[];

  const address = result.address || {};
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    null;

  return {
    id,
    primaryText,
    secondaryText: secondaryText || null,
    fullAddress,
    types,
    location: { lat, lng },
    address: {
      country: address.country || null,
      countryCode: address.country_code
        ? address.country_code.toUpperCase()
        : null,
      state: address.state || null,
      district: address.state_district || address.county || null,
      city,
      postalCode: address.postcode || null,
    },
  };
};

export const getPlaceDetails = async (
  placeId: string,
): Promise<PlaceDetails | null> => {
  const normalizedPlaceId = placeId.trim();
  if (!normalizedPlaceId) return null;

  const parsed = await nominatimRequest<NominatimResult[]>(
    buildNominatimLookupUrl(normalizedPlaceId),
  );
  const result = parsed?.[0];
  if (!result) return null;

  return normalizePlaceDetails(result);
};
