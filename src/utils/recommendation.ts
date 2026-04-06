import {
  getRecommendationRoiPoints,
  recommendationConfig,
} from "@config/recommendation";
import {
  RecommendationExplanationDto,
  RecommendationPreferencesDto,
  RecommendationScoreBreakdownDto,
} from "@dto/recommendation.dto";
import {
  buildLocationSearchProfile,
  matchLocationText,
} from "@utils/nlp/location-parser";

export interface RecommendationPreferences extends RecommendationPreferencesDto {}

export interface RecommendationProperty {
  id?: number;
  title: string;
  location: string;
  description?: string;
  categoryId: number;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  price?: number | null;
  roi?: number | null;
  area?: number | null;
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

const WEIGHTS = recommendationConfig.scoreWeights;

const DEFAULT_LOCATION_RADIUS_KM = recommendationConfig.defaultLocationRadiusKm;
const STRONG_MATCH_THRESHOLD_PERCENT =
  recommendationConfig.strongMatchThresholdPercent;
const CLOSE_PRICE_DELTA_RATIO = recommendationConfig.closePriceDeltaRatio;
const CLOSE_AREA_DELTA_RATIO = recommendationConfig.closeAreaDeltaRatio;

const round2 = (value: number) => Math.round(value * 100) / 100;
const parseMetric = (value: number | null | undefined) =>
  value === null || value === undefined || Number.isNaN(value)
    ? undefined
    : value;

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
  const earthRadiusKm = recommendationConfig.earthRadiusKm;

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
  const locationProfile = preferences.location
    ? buildLocationSearchProfile(preferences.location)
    : undefined;
  const locationTextMatch = matchLocationText(
    {
      location: property.location,
      title: property.title,
      description: property.description,
    },
    locationProfile,
  );

  if (
    preferences.latitude !== undefined &&
    preferences.longitude !== undefined
  ) {
    maxPossible += WEIGHTS.location;

    let points = 0;
    const textPoints = locationTextMatch.matched
      ? round2(WEIGHTS.location * locationTextMatch.ratio)
      : 0;
    const radiusKm =
      preferences.locationRadiusKm !== undefined &&
      preferences.locationRadiusKm > 0
        ? preferences.locationRadiusKm
        : DEFAULT_LOCATION_RADIUS_KM;

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
      const distancePoints = safeRatioScore(
        WEIGHTS.location,
        distanceKm / radiusKm,
      );
      points = Math.max(distancePoints, textPoints);
      const percent = toPercentOfWeight(points, WEIGHTS.location);
      const distanceReason =
        distanceKm <= radiusKm
          ? `Near your preferred location at about ${formatCompactNumber(distanceKm)} km away`
          : `Farther from your preferred location at about ${formatCompactNumber(distanceKm)} km away`;
      const reason =
        textPoints >= distancePoints && locationTextMatch.matched
          ? locationTextMatch.reason
          : distanceReason;
      explanation.push(
        createExplanation(
          "location",
          reason,
          points,
          points > 0 && (distanceKm <= radiusKm || locationTextMatch.matched)
            ? "positive"
            : "negative",
        ),
      );
      if (percent >= STRONG_MATCH_THRESHOLD_PERCENT) {
        pushUnique(topReasons, reason);
      } else {
        pushUnique(penalties, reason);
      }
    } else {
      if (locationTextMatch.matched) {
        points = textPoints;
        const reason = locationTextMatch.reason;
        explanation.push(
          createExplanation(
            "location",
            reason,
            points,
            "positive",
          ),
        );
        if (
          toPercentOfWeight(points, WEIGHTS.location) >=
          STRONG_MATCH_THRESHOLD_PERCENT
        ) {
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
    const points = locationTextMatch.matched
      ? round2(WEIGHTS.location * locationTextMatch.ratio)
      : 0;
    score += points;
    const reason = locationTextMatch.matched
      ? locationTextMatch.reason
      : "Not in your preferred location";
    explanation.push(
      createExplanation(
        "location",
        reason,
        points,
        locationTextMatch.matched ? "positive" : "negative",
      ),
    );
    if (
      toPercentOfWeight(points, WEIGHTS.location) >=
      STRONG_MATCH_THRESHOLD_PERCENT
    ) {
      pushUnique(topReasons, reason);
    } else {
      pushUnique(penalties, reason);
    }
    addBreakdownValue(scoreBreakdown, "location", points);
  }

  if (preferences.price !== undefined && preferences.price > 0) {
    maxPossible += WEIGHTS.price;
    const price = parseMetric(property.price);
    const points =
      price === undefined
        ? 0
        : safeRatioScore(
            WEIGHTS.price,
            Math.abs(price - preferences.price) / preferences.price,
          );
    score += points;
    let reason = "Price data missing, so price preference could not be scored";
    let sentiment: RecommendationExplanationDto["sentiment"] = "neutral";

    if (price !== undefined) {
      const differenceRatio =
        Math.abs(price - preferences.price) / preferences.price;
      if (differenceRatio <= CLOSE_PRICE_DELTA_RATIO) {
        reason = "Close to your preferred price";
        sentiment = "positive";
      } else if (price <= preferences.price) {
        reason = "Within your preferred price, but not especially close";
        sentiment = points > 0 ? "positive" : "negative";
      } else {
        reason = "Above your preferred price";
        sentiment = points > 0 ? "neutral" : "negative";
      }
    }

    explanation.push(createExplanation("price", reason, points, sentiment));
    if (price === undefined) {
      pushUnique(
        penalties,
        "Price data is missing, so price fit could not be confirmed",
      );
    } else if (
      toPercentOfWeight(points, WEIGHTS.price) >= STRONG_MATCH_THRESHOLD_PERCENT
    ) {
      pushUnique(topReasons, reason);
    } else {
      pushUnique(penalties, reason);
    }
    addBreakdownValue(scoreBreakdown, "price", points);
  }

  if (preferences.roi !== undefined && preferences.roi > 0) {
    maxPossible += WEIGHTS.roi;
    const roi = parseMetric(property.roi);
    let points = 0;
    if (roi !== undefined) {
      const roiDifference = preferences.roi - roi;
      points = getRecommendationRoiPoints(roiDifference);
    }
    score += points;
    let reason = "ROI data missing, so ROI preference could not be scored";
    let sentiment: RecommendationExplanationDto["sentiment"] = "neutral";

    if (roi !== undefined) {
      if (roi >= preferences.roi) {
        reason = "Meets your ROI target";
        sentiment = "positive";
      } else {
        reason = "Below your ROI target";
        sentiment = "negative";
      }
    }

    explanation.push(createExplanation("roi", reason, points, sentiment));
    if (roi === undefined) {
      pushUnique(
        penalties,
        "ROI data is missing, so return potential could not be confirmed",
      );
    } else if (points >= WEIGHTS.roi) {
      pushUnique(topReasons, reason);
    } else {
      pushUnique(penalties, reason);
    }
    addBreakdownValue(scoreBreakdown, "roi", points);
  }

  if (preferences.area !== undefined && preferences.area > 0) {
    maxPossible += WEIGHTS.area;
    const area = parseMetric(property.area);
    const points =
      area === undefined
        ? 0
        : safeRatioScore(
            WEIGHTS.area,
            Math.abs(area - preferences.area) / preferences.area,
          );
    score += points;
    let reason = "Area data missing, so area preference could not be scored";
    let sentiment: RecommendationExplanationDto["sentiment"] = "neutral";

    if (area !== undefined) {
      if (
        Math.abs(area - preferences.area) / preferences.area <=
        CLOSE_AREA_DELTA_RATIO
      ) {
        reason = "Close to your preferred property size";
        sentiment = "positive";
      } else if (area >= preferences.area) {
        reason = "Larger than your preferred property size";
        sentiment = points > 0 ? "neutral" : "negative";
      } else {
        reason = "Smaller than your preferred property size";
        sentiment = points > 0 ? "neutral" : "negative";
      }
    }

    explanation.push(createExplanation("area", reason, points, sentiment));
    if (area === undefined) {
      pushUnique(
        penalties,
        "Area data is missing, so size fit could not be confirmed",
      );
    } else if (
      toPercentOfWeight(points, WEIGHTS.area) >= STRONG_MATCH_THRESHOLD_PERCENT
    ) {
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
    } else if (
      toPercentOfWeight(points, WEIGHTS.distance) >=
      STRONG_MATCH_THRESHOLD_PERCENT
    ) {
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
