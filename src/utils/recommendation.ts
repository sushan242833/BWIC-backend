import {
  RecommendationExplanationDto,
  RecommendationMustHaveDto,
  RecommendationPreferencesDto,
  RecommendationScoreBreakdownDto,
} from "@dto/recommendation.dto";

export interface RecommendationMustHave extends RecommendationMustHaveDto {}

export interface RecommendationPreferences extends RecommendationPreferencesDto {}

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

export interface RecommendationScore {
  score: number;
  maxPossible: number;
  matchPercentage: number;
  explanation: RecommendationExplanationDto[];
  rankingSummary: string;
  topReasons: string[];
  penalties: string[];
  scoreBreakdown?: RecommendationScoreBreakdownDto;
}

const WEIGHTS = {
  location: 25,
  price: 30,
  roi: 15,
  area: 15,
  distance: 15,
} as const;

const round2 = (value: number) => Math.round(value * 100) / 100;

const roundScore = (value: number) => round2(Math.max(0, value));

const safeRatioScore = (weight: number, deltaRatio: number): number => {
  const score = weight * Math.max(0, 1 - deltaRatio);
  return round2(score);
};

const toPercentOfWeight = (points: number, weight: number) =>
  weight > 0 ? round2((points / weight) * 100) : 0;

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(round2(value));

const createExplanation = (
  category: keyof RecommendationScoreBreakdownDto,
  reason: string,
  points: number,
  sentiment: RecommendationExplanationDto["sentiment"],
): RecommendationExplanationDto => ({
  category,
  reason,
  points: roundScore(points),
  sentiment,
});

const addBreakdownValue = (
  scoreBreakdown: RecommendationScoreBreakdownDto,
  key: keyof RecommendationScoreBreakdownDto,
  value: number,
) => {
  scoreBreakdown[key] = roundScore(value);
};

const pushUnique = (items: string[], value: string | undefined) => {
  if (!value || items.includes(value)) {
    return;
  }

  items.push(value);
};

const buildRankingSummary = (
  topReasons: string[],
  penalties: string[],
  matchPercentage: number,
): string => {
  if (topReasons.length === 0 && penalties.length === 0) {
    return "This property was ranked using the available filters, but no preference-based scoring could be applied.";
  }

  if (topReasons.length === 0) {
    return `This property stayed in the results, but ranked lower at ${matchPercentage}% because it did not align well with your preferences.`;
  }

  if (penalties.length === 0) {
    return `This property ranked strongly at ${matchPercentage}% because ${topReasons[0].charAt(0).toLowerCase()}${topReasons[0].slice(1)}.`;
  }

  return `This property ranked at ${matchPercentage}% because ${topReasons[0].charAt(0).toLowerCase()}${topReasons[0].slice(1)}, though ${penalties[0].charAt(0).toLowerCase()}${penalties[0].slice(1)}.`;
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

export const applyHardFilters = <T extends RecommendationProperty>(
  properties: T[],
  mustHave: RecommendationMustHave,
): T[] => {
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
  const explanation: RecommendationExplanationDto[] = [];
  const topReasons: string[] = [];
  const penalties: string[] = [];
  const scoreBreakdown: RecommendationScoreBreakdownDto = {};
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
      const percent = toPercentOfWeight(points, WEIGHTS.location);
      const reason =
        distanceKm <= radiusKm
          ? `Near your preferred location at about ${formatCompactNumber(distanceKm)} km away`
          : `Farther from your preferred location at about ${formatCompactNumber(distanceKm)} km away`;
      explanation.push(
        createExplanation(
          "location",
          reason,
          points,
          distanceKm <= radiusKm ? "positive" : "negative",
        ),
      );
      if (percent >= 60) {
        pushUnique(topReasons, reason);
      } else {
        pushUnique(penalties, reason);
      }
    } else {
      if (preferences.location) {
        const matched = property.location
          .toLowerCase()
          .includes(preferences.location.toLowerCase());
        points = matched ? WEIGHTS.location : 0;
        const reason = matched
          ? `Near your preferred location based on the listed area`
          : `Does not appear to be near your preferred location based on the listed area`;
        explanation.push(
          createExplanation(
            "location",
            reason,
            points,
            matched ? "positive" : "negative",
          ),
        );
        if (matched) {
          pushUnique(topReasons, reason);
        } else {
          pushUnique(penalties, reason);
        }
      } else {
        explanation.push(
          createExplanation(
            "location",
            "Location coordinates are missing, so distance preference could not be scored",
            0,
            "neutral",
          ),
        );
        pushUnique(
          penalties,
          "Location coordinates are missing, so proximity could not be confirmed",
        );
      }
    }

    score += points;
    addBreakdownValue(scoreBreakdown, "location", points);
  } else if (preferences.location) {
    maxPossible += WEIGHTS.location;
    const matched = property.location
      .toLowerCase()
      .includes(preferences.location.toLowerCase());
    const points = matched ? WEIGHTS.location : 0;
    score += points;
    const reason = matched
      ? "Near your preferred location"
      : "Not in your preferred location";
    explanation.push(
      createExplanation(
        "location",
        reason,
        points,
        matched ? "positive" : "negative",
      ),
    );
    if (matched) {
      pushUnique(topReasons, reason);
    } else {
      pushUnique(penalties, reason);
    }
    addBreakdownValue(scoreBreakdown, "location", points);
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
    let reason = "Price data missing, so budget preference could not be scored";
    let sentiment: RecommendationExplanationDto["sentiment"] = "neutral";

    if (price !== null && price !== undefined) {
      const differenceRatio = Math.abs(price - preferences.budget) / preferences.budget;
      if (differenceRatio <= 0.1) {
        reason = "Close to your preferred budget";
        sentiment = "positive";
      } else if (price <= preferences.budget) {
        reason = "Within your preferred budget, but not especially close";
        sentiment = points > 0 ? "positive" : "negative";
      } else {
        reason = "Above your preferred budget";
        sentiment = points > 0 ? "neutral" : "negative";
      }
    }

    explanation.push(createExplanation("price", reason, points, sentiment));
    if (price === null || price === undefined) {
      pushUnique(
        penalties,
        "Price data is missing, so budget fit could not be confirmed",
      );
    } else if (toPercentOfWeight(points, WEIGHTS.price) >= 60) {
      pushUnique(topReasons, reason);
    } else {
      pushUnique(penalties, reason);
    }
    addBreakdownValue(scoreBreakdown, "price", points);
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
    let reason = "ROI data missing, so ROI preference could not be scored";
    let sentiment: RecommendationExplanationDto["sentiment"] = "neutral";

    if (roi !== null && roi !== undefined) {
      if (roi >= preferences.roiPercent) {
        reason = "Meets your ROI target";
        sentiment = "positive";
      } else {
        reason = "Below your ROI target";
        sentiment = points > 0 ? "neutral" : "negative";
      }
    }

    explanation.push(createExplanation("roi", reason, points, sentiment));
    if (roi === null || roi === undefined) {
      pushUnique(
        penalties,
        "ROI data is missing, so return potential could not be confirmed",
      );
    } else if (toPercentOfWeight(points, WEIGHTS.roi) >= 60) {
      pushUnique(topReasons, reason);
    } else {
      pushUnique(penalties, reason);
    }
    addBreakdownValue(scoreBreakdown, "roi", points);
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
    let reason = "Area data missing, so area preference could not be scored";
    let sentiment: RecommendationExplanationDto["sentiment"] = "neutral";

    if (area !== null && area !== undefined) {
      if (
        Math.abs(area - preferences.areaSqft) / preferences.areaSqft <=
        0.15
      ) {
        reason = "Close to your preferred property size";
        sentiment = "positive";
      } else if (area >= preferences.areaSqft) {
        reason = "Larger than your preferred property size";
        sentiment = points > 0 ? "neutral" : "negative";
      } else {
        reason = "Smaller than your preferred property size";
        sentiment = points > 0 ? "neutral" : "negative";
      }
    }

    explanation.push(createExplanation("area", reason, points, sentiment));
    if (area === null || area === undefined) {
      pushUnique(
        penalties,
        "Area data is missing, so size fit could not be confirmed",
      );
    } else if (toPercentOfWeight(points, WEIGHTS.area) >= 60) {
      pushUnique(topReasons, reason);
    } else {
      pushUnique(penalties, reason);
    }
    addBreakdownValue(scoreBreakdown, "area", points);
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
    let reason =
      "Distance from highway data missing, so access preference could not be scored";
    let sentiment: RecommendationExplanationDto["sentiment"] = "neutral";

    if (distance !== null && distance !== undefined) {
      if (distance <= preferences.maxDistanceFromHighway) {
        reason = "Within your preferred distance from the highway";
        sentiment = "positive";
      } else {
        reason = "Farther from highway than preferred";
        sentiment = points > 0 ? "neutral" : "negative";
      }
    }

    explanation.push(createExplanation("distance", reason, points, sentiment));
    if (distance === null || distance === undefined) {
      pushUnique(
        penalties,
        "Distance from highway data is missing, so accessibility fit could not be confirmed",
      );
    } else if (toPercentOfWeight(points, WEIGHTS.distance) >= 60) {
      pushUnique(topReasons, reason);
    } else {
      pushUnique(penalties, reason);
    }
    addBreakdownValue(scoreBreakdown, "distance", points);
  }

  const matchPercentage =
    maxPossible === 0 ? 0 : Math.round((score / maxPossible) * 100);
  const normalizedScore = round2(score);
  const normalizedBreakdown =
    Object.keys(scoreBreakdown).length > 0 ? scoreBreakdown : undefined;

  return {
    score: normalizedScore,
    maxPossible,
    matchPercentage,
    explanation,
    rankingSummary: buildRankingSummary(topReasons, penalties, matchPercentage),
    topReasons,
    penalties,
    scoreBreakdown: normalizedBreakdown,
  };
};
