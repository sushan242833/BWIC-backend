export interface RecommendationMustHave {
  location?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  minRoi?: number;
  minArea?: number;
  maxDistanceFromHighway?: number;
  status?: string;
}

export interface RecommendationPreferences {
  location?: string;
  latitude?: number;
  longitude?: number;
  locationRadiusKm?: number;
  budget?: number;
  roiPercent?: number;
  areaSqft?: number;
  maxDistanceFromHighway?: number;
}

export interface RecommendationProperty {
  id?: number;
  title: string;
  location: string;
  categoryId: number;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  priceNpr?: number | null;
  roiPercent?: number | null;
  areaSqft?: number | null;
  distanceFromHighway?: number | null;
}

export interface RecommendationExplanation {
  reason: string;
  points: number;
}

export interface RecommendationScore {
  score: number;
  maxPossible: number;
  matchPercentage: number;
  explanation: RecommendationExplanation[];
}

const WEIGHTS = {
  location: 25,
  price: 30,
  roi: 15,
  area: 15,
  distance: 15,
} as const;

const round2 = (value: number) => Math.round(value * 100) / 100;

const safeRatioScore = (weight: number, deltaRatio: number): number => {
  const score = weight * Math.max(0, 1 - deltaRatio);
  return round2(score);
};

const haversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

export const applyHardFilters = (
  properties: RecommendationProperty[],
  mustHave: RecommendationMustHave,
): RecommendationProperty[] => {
  return properties.filter((property) => {
    if (
      mustHave.location &&
      !property.location.toLowerCase().includes(mustHave.location.toLowerCase())
    ) {
      return false;
    }

    if (
      mustHave.categoryId !== undefined &&
      property.categoryId !== mustHave.categoryId
    ) {
      return false;
    }

    if (
      mustHave.status &&
      property.status.toLowerCase() !== mustHave.status.toLowerCase()
    ) {
      return false;
    }

    if (mustHave.minPrice !== undefined) {
      if (property.priceNpr === null || property.priceNpr === undefined)
        return false;
      if (property.priceNpr < mustHave.minPrice) return false;
    }

    if (mustHave.maxPrice !== undefined) {
      if (property.priceNpr === null || property.priceNpr === undefined)
        return false;
      if (property.priceNpr > mustHave.maxPrice) return false;
    }

    if (mustHave.minRoi !== undefined) {
      if (property.roiPercent === null || property.roiPercent === undefined)
        return false;
      if (property.roiPercent < mustHave.minRoi) return false;
    }

    if (mustHave.minArea !== undefined) {
      if (property.areaSqft === null || property.areaSqft === undefined)
        return false;
      if (property.areaSqft < mustHave.minArea) return false;
    }

    if (mustHave.maxDistanceFromHighway !== undefined) {
      if (
        property.distanceFromHighway === null ||
        property.distanceFromHighway === undefined
      ) {
        return false;
      }
      if (property.distanceFromHighway > mustHave.maxDistanceFromHighway) {
        return false;
      }
    }

    return true;
  });
};

export const scoreProperty = (
  property: RecommendationProperty,
  preferences: RecommendationPreferences,
): RecommendationScore => {
  const explanation: RecommendationExplanation[] = [];
  let score = 0;
  let maxPossible = 0;

  if (
    preferences.latitude !== undefined &&
    preferences.longitude !== undefined
  ) {
    maxPossible += WEIGHTS.location;

    let points = 0;
    const radiusKm =
      preferences.locationRadiusKm !== undefined &&
      preferences.locationRadiusKm > 0
        ? preferences.locationRadiusKm
        : 10;

    if (
      property.latitude !== null &&
      property.latitude !== undefined &&
      property.longitude !== null &&
      property.longitude !== undefined
    ) {
      const distanceKm = haversineKm(
        preferences.latitude,
        preferences.longitude,
        property.latitude,
        property.longitude,
      );
      points = safeRatioScore(WEIGHTS.location, distanceKm / radiusKm);
      explanation.push({
        reason: `Location scored by distance (${round2(distanceKm)} km from preferred point, radius ${radiusKm} km)`,
        points,
      });
    } else {
      if (preferences.location) {
        const matched = property.location
          .toLowerCase()
          .includes(preferences.location.toLowerCase());
        points = matched ? WEIGHTS.location : 0;
        explanation.push({
          reason: matched
            ? `Property coordinates missing, text location fallback matched (${preferences.location})`
            : `Property coordinates missing, text location fallback did not match (${preferences.location})`,
          points,
        });
      } else {
        explanation.push({
          reason: "Property coordinates missing, could not score geo-distance",
          points: 0,
        });
      }
    }

    score += points;
  } else if (preferences.location) {
    maxPossible += WEIGHTS.location;
    const matched = property.location
      .toLowerCase()
      .includes(preferences.location.toLowerCase());
    const points = matched ? WEIGHTS.location : 0;
    score += points;
    explanation.push({
      reason: matched
        ? `Location text matched preference (${preferences.location})`
        : `Location text did not match preference (${preferences.location})`,
      points,
    });
  }

  if (preferences.budget !== undefined && preferences.budget > 0) {
    maxPossible += WEIGHTS.price;
    const price = property.priceNpr;
    const points =
      price === null || price === undefined
        ? 0
        : safeRatioScore(
            WEIGHTS.price,
            Math.abs(price - preferences.budget) / preferences.budget,
          );
    score += points;
    explanation.push({
      reason:
        price === null || price === undefined
          ? "Price missing, could not score budget closeness"
          : `Budget closeness scored against NPR ${preferences.budget}`,
      points,
    });
  }

  if (preferences.roiPercent !== undefined && preferences.roiPercent > 0) {
    maxPossible += WEIGHTS.roi;
    const roi = property.roiPercent;
    let points = 0;
    if (roi !== null && roi !== undefined) {
      points =
        roi >= preferences.roiPercent
          ? WEIGHTS.roi
          : round2(WEIGHTS.roi * Math.max(0, roi / preferences.roiPercent));
    }
    score += points;
    explanation.push({
      reason:
        roi === null || roi === undefined
          ? "ROI missing, could not score ROI preference"
          : `ROI scored against preferred ${preferences.roiPercent}%`,
      points,
    });
  }

  if (preferences.areaSqft !== undefined && preferences.areaSqft > 0) {
    maxPossible += WEIGHTS.area;
    const area = property.areaSqft;
    const points =
      area === null || area === undefined
        ? 0
        : safeRatioScore(
            WEIGHTS.area,
            Math.abs(area - preferences.areaSqft) / preferences.areaSqft,
          );
    score += points;
    explanation.push({
      reason:
        area === null || area === undefined
          ? "Area missing, could not score area preference"
          : `Area closeness scored against ${preferences.areaSqft} sq ft`,
      points,
    });
  }

  if (
    preferences.maxDistanceFromHighway !== undefined &&
    preferences.maxDistanceFromHighway > 0
  ) {
    maxPossible += WEIGHTS.distance;
    const distance = property.distanceFromHighway;
    let points = 0;

    if (distance !== null && distance !== undefined) {
      if (distance <= preferences.maxDistanceFromHighway) {
        points = WEIGHTS.distance;
      } else {
        points = safeRatioScore(
          WEIGHTS.distance,
          (distance - preferences.maxDistanceFromHighway) /
            preferences.maxDistanceFromHighway,
        );
      }
    }

    score += points;
    explanation.push({
      reason:
        distance === null || distance === undefined
          ? "Distance from highway missing, could not score distance preference"
          : `Distance scored against preferred max ${preferences.maxDistanceFromHighway}m`,
      points,
    });
  }

  const matchPercentage =
    maxPossible === 0 ? 0 : Math.round((score / maxPossible) * 100);

  return {
    score: round2(score),
    maxPossible,
    matchPercentage,
    explanation,
  };
};
