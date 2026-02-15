import https from "https";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface GoogleGeocodeResponse {
  status: string;
  results?: Array<{
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
}

interface GooglePlacesAutocompleteResponse {
  status: string;
  predictions?: Array<{
    description?: string;
    place_id?: string;
  }>;
}

const GOOGLE_GEOCODE_BASE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOGLE_PLACES_AUTOCOMPLETE_BASE_URL =
  "https://maps.googleapis.com/maps/api/place/autocomplete/json";

export const geocodeLocation = async (
  location: string,
): Promise<Coordinates | null> => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey || !location.trim()) {
    return null;
  }

  const url = `${GOOGLE_GEOCODE_BASE_URL}?address=${encodeURIComponent(location)}&key=${apiKey}`;

  return new Promise<Coordinates | null>((resolve) => {
    https
      .get(url, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const parsed = JSON.parse(data) as GoogleGeocodeResponse;
            if (parsed.status !== "OK") {
              resolve(null);
              return;
            }

            const point = parsed.results?.[0]?.geometry?.location;
            if (
              !point ||
              typeof point.lat !== "number" ||
              typeof point.lng !== "number"
            ) {
              resolve(null);
              return;
            }

            resolve({
              latitude: point.lat,
              longitude: point.lng,
            });
          } catch {
            resolve(null);
          }
        });
      })
      .on("error", () => resolve(null));
  });
};

export interface LocationSuggestion {
  placeId: string;
  description: string;
}

export const autocompleteLocations = async (
  query: string,
): Promise<LocationSuggestion[]> => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey || !query.trim()) {
    if (!apiKey) {
      console.error(
        "Google autocomplete disabled: GOOGLE_MAPS_API_KEY is not set",
      );
    }
    return [];
  }

  const url = `${GOOGLE_PLACES_AUTOCOMPLETE_BASE_URL}?input=${encodeURIComponent(
    query,
  )}&types=geocode&key=${apiKey}`;

  return new Promise<LocationSuggestion[]>((resolve) => {
    https
      .get(url, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const parsed = JSON.parse(data) as GooglePlacesAutocompleteResponse;
            if (parsed.status !== "OK" && parsed.status !== "ZERO_RESULTS") {
              console.error(
                `Google Places autocomplete failed with status: ${parsed.status}`,
              );
              console.error("Google Places response:", data);
              resolve([]);
              return;
            }

            const suggestions =
              parsed.predictions
                ?.map((item) => ({
                  placeId: item.place_id || "",
                  description: item.description || "",
                }))
                .filter((item) => item.placeId && item.description) || [];

            resolve(suggestions);
          } catch {
            resolve([]);
          }
        });
      })
      .on("error", () => resolve([]));
  });
};
