import type {
  RecommendationLocationCoordinateDto,
  RecommendationMustHaveDto,
  RecommendationPreferencesDto,
} from "@dto/recommendation.dto";

type LocationPayload =
  | Partial<RecommendationMustHaveDto>
  | Partial<RecommendationPreferencesDto>
  | null
  | undefined;

const LOCATION_SEPARATOR_PATTERN = /\s*(?:\bor\b|\/|;|\|)\s*/gi;

const normalizeLocationLabel = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

export const dedupeLocationLabels = (values: Iterable<string>): string[] => {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = normalizeLocationLabel(value);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    labels.push(normalized);
  }

  return labels;
};

export const splitLocationLabel = (value: string): string[] => {
  const normalized = normalizeLocationLabel(value);
  if (!normalized) {
    return [];
  }

  return dedupeLocationLabels(
    normalized
      .split(LOCATION_SEPARATOR_PATTERN)
      .map((candidate) => candidate.trim())
      .filter(Boolean),
  );
};

export const getNormalizedLocationLabels = (
  value: string | string[] | undefined | null,
): string[] => {
  if (Array.isArray(value)) {
    return dedupeLocationLabels(
      value.flatMap((candidate) => splitLocationLabel(candidate)),
    );
  }

  if (typeof value === "string") {
    return splitLocationLabel(value);
  }

  return [];
};

export const getLocationNamesFromPayload = (
  payload: LocationPayload,
): string[] =>
  dedupeLocationLabels([
    ...getNormalizedLocationLabels(payload?.locations),
    ...getNormalizedLocationLabels(payload?.location),
  ]);

export const hasLocationCriteria = (payload: LocationPayload): boolean =>
  getLocationNamesFromPayload(payload).length > 0;

export const getCoordinatesFromPayload = (
  payload:
    | Pick<
        RecommendationPreferencesDto,
        "coordinates" | "latitude" | "longitude"
      >
    | null
    | undefined,
): RecommendationLocationCoordinateDto[] => {
  const explicitCoordinates =
    payload?.coordinates?.filter(
      (coordinate) =>
        Number.isFinite(coordinate.latitude) &&
        Number.isFinite(coordinate.longitude),
    ) ?? [];

  if (explicitCoordinates.length > 0) {
    return explicitCoordinates;
  }

  if (
    Number.isFinite(payload?.latitude) &&
    Number.isFinite(payload?.longitude)
  ) {
    return [
      {
        latitude: payload?.latitude as number,
        longitude: payload?.longitude as number,
      },
    ];
  }

  return [];
};

export const parseCoordinateString = (
  value: string,
): RecommendationLocationCoordinateDto | null => {
  const [rawLatitude, rawLongitude] = value.split(",", 2);
  if (!rawLatitude || !rawLongitude) {
    return null;
  }

  const latitude = Number.parseFloat(rawLatitude.trim());
  const longitude = Number.parseFloat(rawLongitude.trim());

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
};
