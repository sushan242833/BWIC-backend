import https from "https";
import { appConfig } from "@config/app";
import env from "@config/env";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface NominatimResult {
  place_id?: number | string;
  osm_id?: number | string;
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

interface GeocodingConfig {
  provider: typeof appConfig.geocoding.provider;
  baseUrl: string;
  userAgent: string;
  timeoutMs: number;
  geocodeLimit: number;
  autocompleteLimit: number;
  language: string;
  countryCodes?: string;
}

type LookupParamName = "osm_ids" | "place_ids";

const config: GeocodingConfig = {
  provider: appConfig.geocoding.provider,
  baseUrl: env.geocoding.baseUrl.trim(),
  userAgent: appConfig.geocoding.userAgent,
  timeoutMs: appConfig.geocoding.timeoutMs,
  geocodeLimit: appConfig.geocoding.geocodeLimit,
  autocompleteLimit: appConfig.geocoding.autocompleteLimit,
  language: appConfig.geocoding.language,
  countryCodes: appConfig.geocoding.countryCodes,
};

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

const buildNominatimLookupUrl = (
  paramName: LookupParamName,
  identifier: string,
): URL => {
  const url = new URL("/lookup", config.baseUrl);
  url.searchParams.set(paramName, identifier);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", config.language);
  return url;
};

const OSM_LOOKUP_PREFIX_BY_TYPE: Record<
  NonNullable<NominatimResult["osm_type"]>,
  "N" | "W" | "R"
> = {
  node: "N",
  way: "W",
  relation: "R",
};

const normalizeIdentifier = (value: number | string | undefined): string =>
  value === undefined ? "" : String(value).trim();

const toStableLookupIdentifier = (result: NominatimResult): string => {
  const osmType = result.osm_type;
  const osmId = normalizeIdentifier(result.osm_id);

  if (osmType && osmId) {
    return `${OSM_LOOKUP_PREFIX_BY_TYPE[osmType]}${osmId}`;
  }

  return normalizeIdentifier(result.place_id);
};

const resolveLookupTarget = (
  placeId: string,
): { paramName: LookupParamName; identifier: string } | null => {
  const normalized = placeId.trim();
  if (!normalized) return null;

  if (/^[NWR]\d+$/i.test(normalized)) {
    return {
      paramName: "osm_ids",
      identifier: normalized.toUpperCase(),
    };
  }

  const legacyOsmReference = normalized.match(/^(node|way|relation):(\d+)$/i);
  if (legacyOsmReference) {
    const [, osmType, osmId] = legacyOsmReference;
    const prefix =
      OSM_LOOKUP_PREFIX_BY_TYPE[
        osmType.toLowerCase() as NonNullable<NominatimResult["osm_type"]>
      ];

    return {
      paramName: "osm_ids",
      identifier: `${prefix}${osmId}`,
    };
  }

  return {
    paramName: "place_ids",
    identifier: normalized,
  };
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
      // `place_id` is not stable across Nominatim updates, so prefer OSM ids.
      placeId: toStableLookupIdentifier(item),
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

const normalizePlaceDetails = (
  result: NominatimResult,
): PlaceDetails | null => {
  const lat = Number.parseFloat(result.lat || "");
  const lng = Number.parseFloat(result.lon || "");
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const fullAddress = result.display_name || "";
  if (!fullAddress) return null;

  const primaryText =
    result.name?.trim() || fullAddress.split(",")[0]?.trim() || "";
  const secondaryText = fullAddress.startsWith(`${primaryText},`)
    ? fullAddress.slice(primaryText.length + 1).trim()
    : fullAddress;

  const id =
    toStableLookupIdentifier(result) ||
    `${result.osm_type || "place"}:${normalizeIdentifier(result.osm_id)}`;

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
  const lookupTarget = resolveLookupTarget(placeId);
  if (!lookupTarget) return null;

  const parsed = await nominatimRequest<NominatimResult[]>(
    buildNominatimLookupUrl(
      lookupTarget.paramName,
      lookupTarget.identifier,
    ),
  );
  const result = parsed?.[0];
  if (!result) return null;

  return normalizePlaceDetails(result);
};
