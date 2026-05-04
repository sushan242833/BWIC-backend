import { recommendationConfig } from "@config/recommendation";
import type { PropertyStatus } from "@constants/property";
import type { RecommendationWeights } from "@constants/recommendation-weights";
import type {
  RecommendationDetailDto,
  RecommendationRequestDto,
  RecommendationResponseMetaDto,
  RecommendationResultDto,
} from "@dto/recommendation.dto";
import { Category } from "@models/category.model";
import { Property } from "@models/properties.model";
import recommendationQueryParserService, {
  type ParsedRecommendationQueryResult,
} from "@services/recommendation-query-parser.service";
import recommendationWeightService from "@services/recommendation-weight.service";
import type { PaginationMeta } from "@utils/api-response";
import { geocodeLocation } from "@utils/geocoding";
import {
  type RecommendationPropertyFilterQuery,
  buildRecommendationPropertyWhere,
} from "@utils/property-filters";
import { serializePropertySummary } from "@utils/property-serializers";
import {
  getCoordinatesFromPayload,
  getLocationNamesFromPayload,
  hasLocationCriteria,
  parseCoordinateString,
} from "@utils/recommendation-locations";
import {
  RecommendationPreferences,
  scoreProperty,
} from "@utils/recommendation";
import { buildLocationSearchProfile } from "@utils/nlp/location-parser";
import { AppError } from "../middleware/error.middleware";

export interface RecommendationServiceResponse {
  data: RecommendationResultDto[];
  pagination: PaginationMeta;
  meta: RecommendationResponseMetaDto;
}

interface RankedRecommendationContext {
  ranked: RecommendationResultDto[];
  meta: RecommendationResponseMetaDto;
  preferences: RecommendationPreferences;
  weights: RecommendationWeights;
}

interface RecommendationScoringContext {
  parsedQuery: ParsedRecommendationQueryResult;
  meta: RecommendationResponseMetaDto;
  preferences: RecommendationPreferences;
  weights: RecommendationWeights;
}

interface RecommendationVisibilityOptions {
  hasLocationPreference: boolean;
  hasScoringPreferences: boolean;
  minimumMatchPercentage: number;
  allowZeroMatchResults: boolean;
}

export const filterVisibleRecommendations = (
  items: RecommendationResultDto[],
  options: RecommendationVisibilityOptions,
): RecommendationResultDto[] => {
  let visibleItems = options.allowZeroMatchResults
    ? [...items]
    : items.filter((item) => item.matchPercentage > 0);

  if (options.hasLocationPreference) {
    visibleItems = visibleItems.filter(
      (item) => (item.scoreBreakdown?.location ?? 0) > 0,
    );
  }

  if (!options.hasScoringPreferences) {
    return visibleItems;
  }

  return visibleItems.filter(
    (item) => item.matchPercentage >= options.minimumMatchPercentage,
  );
};

export class RecommendationService {
  private readonly topRecommendationLimit =
    recommendationConfig.topRecommendationLimit;
  private readonly minimumRecommendationMatchPercentage =
    recommendationConfig.minimumMatchPercentage;
  private readonly defaultRecommendationPageSize =
    recommendationConfig.defaultPageSize;
  private readonly maxRecommendationPageSize = recommendationConfig.maxPageSize;

  private extractQueryString(value: unknown): string | undefined {
    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value)) {
      const first = value[0];
      return typeof first === "string" ? first : undefined;
    }

    return undefined;
  }

  private extractQueryStrings(value: unknown): string[] {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }

    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((candidate): candidate is string => typeof candidate === "string")
      .map((candidate) => candidate.trim())
      .filter(Boolean);
  }

  private parseNumber(value: unknown): number | undefined {
    if (typeof value === "number") {
      return Number.isNaN(value) ? undefined : value;
    }

    const raw = this.extractQueryString(value);
    if (!raw) {
      return undefined;
    }

    const parsed = Number.parseFloat(raw.replace(/,/g, "").trim());
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private parseCoordinateList(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((candidate) => {
        if (
          candidate &&
          typeof candidate === "object" &&
          "latitude" in candidate &&
          "longitude" in candidate
        ) {
          const latitude = this.parseNumber(
            (candidate as Record<string, unknown>).latitude,
          );
          const longitude = this.parseNumber(
            (candidate as Record<string, unknown>).longitude,
          );

          if (latitude !== undefined && longitude !== undefined) {
            return { latitude, longitude };
          }

          return null;
        }

        if (typeof candidate === "string") {
          return parseCoordinateString(candidate);
        }

        return null;
      })
      .filter((candidate): candidate is { latitude: number; longitude: number } =>
        candidate !== null,
      );
  }

  private normalizePagination(
    page?: number,
    limit?: number,
  ): Pick<PaginationMeta, "page" | "limit"> {
    return {
      page: Math.max(1, Math.trunc(page || 1)),
      limit: Math.min(
        this.maxRecommendationPageSize,
        Math.max(1, Math.trunc(limit || this.defaultRecommendationPageSize)),
      ),
    };
  }

  private hasLocationPreference(
    preferences: RecommendationPreferences,
    weights: RecommendationWeights,
  ): boolean {
    return Boolean(
      weights.location > 0 &&
        (hasLocationCriteria(preferences) ||
          getCoordinatesFromPayload(preferences).length > 0),
    );
  }

  private hasScoringPreferences(
    preferences: RecommendationPreferences,
    weights: RecommendationWeights,
  ): boolean {
    return Boolean(
      (weights.location > 0 &&
        (hasLocationCriteria(preferences) ||
          getCoordinatesFromPayload(preferences).length > 0)) ||
        (weights.price > 0 &&
          ((preferences.price !== undefined && preferences.price > 0) ||
            (preferences.priceCeiling !== undefined &&
              preferences.priceCeiling > 0))) ||
        (weights.roi > 0 &&
          preferences.roi !== undefined &&
          preferences.roi > 0) ||
        (weights.area > 0 &&
          preferences.area !== undefined &&
          preferences.area > 0) ||
        (weights.highwayAccess > 0 &&
          preferences.maxDistanceFromHighway !== undefined &&
          preferences.maxDistanceFromHighway > 0),
    );
  }

  private buildScoringPreferences(
    preferences: RecommendationPreferences,
    mustHave: RecommendationRequestDto["mustHave"],
  ): RecommendationPreferences {
    const preferredLocations = getLocationNamesFromPayload(preferences);
    const fallbackLocations = getLocationNamesFromPayload(mustHave);
    const coordinates = getCoordinatesFromPayload(preferences);

    return {
      ...preferences,
      location: preferredLocations[0] ?? fallbackLocations[0],
      locations:
        preferredLocations.length > 0 ? preferredLocations : fallbackLocations,
      latitude: coordinates[0]?.latitude,
      longitude: coordinates[0]?.longitude,
      coordinates: coordinates.length > 0 ? coordinates : undefined,
      priceCeiling:
        preferences.price !== undefined ||
        mustHave?.maxPrice === undefined ||
        mustHave.maxPrice <= 0
          ? preferences.priceCeiling
          : mustHave.maxPrice,
      roi:
        preferences.roi !== undefined && preferences.roi > 0
          ? preferences.roi
          : mustHave?.minRoi,
      area:
        preferences.area !== undefined && preferences.area > 0
          ? preferences.area
          : mustHave?.minArea,
      maxDistanceFromHighway:
        preferences.maxDistanceFromHighway !== undefined &&
        preferences.maxDistanceFromHighway > 0
          ? preferences.maxDistanceFromHighway
          : mustHave?.maxDistanceFromHighway,
      status: preferences.status ?? mustHave?.status,
    };
  }

  private buildLocationScopedCandidateWhere(
    mustHave: RecommendationRequestDto["mustHave"],
    preferences: RecommendationPreferences,
    weights: RecommendationWeights,
  ) {
    const mustHaveLocations = getLocationNamesFromPayload(mustHave);
    const inactivePriceToleranceRatio =
      recommendationConfig.inactivePreferencePriceToleranceRatio;
    const inactiveAreaToleranceRatio =
      recommendationConfig.inactivePreferenceAreaToleranceRatio;
    const inactiveRoiFloorRatio =
      recommendationConfig.inactivePreferenceRoiFloorRatio;
    const inactivePreferenceScope: RecommendationPropertyFilterQuery = {};

    if (
      weights.price <= 0 &&
      mustHave?.maxPrice === undefined &&
      preferences.price !== undefined &&
      preferences.price > 0
    ) {
      inactivePreferenceScope.minPrice = Math.max(
        0,
        Math.round(preferences.price * (1 - inactivePriceToleranceRatio)),
      );
      inactivePreferenceScope.maxPrice = Math.round(
        preferences.price * (1 + inactivePriceToleranceRatio),
      );
    }

    if (
      weights.roi <= 0 &&
      mustHave?.minRoi === undefined &&
      preferences.roi !== undefined &&
      preferences.roi > 0
    ) {
      inactivePreferenceScope.minRoi = Number(
        Math.max(0, preferences.roi * inactiveRoiFloorRatio).toFixed(2),
      );
    }

    if (
      weights.area <= 0 &&
      mustHave?.minArea === undefined &&
      preferences.area !== undefined &&
      preferences.area > 0
    ) {
      inactivePreferenceScope.minArea = Math.max(
        0,
        Math.round(preferences.area * (1 - inactiveAreaToleranceRatio)),
      );
      inactivePreferenceScope.maxArea = Math.round(
        preferences.area * (1 + inactiveAreaToleranceRatio),
      );
    }

    if (
      weights.highwayAccess <= 0 &&
      mustHave?.maxDistanceFromHighway === undefined &&
      preferences.maxDistanceFromHighway !== undefined &&
      preferences.maxDistanceFromHighway > 0
    ) {
      inactivePreferenceScope.maxDistanceFromHighway =
        preferences.maxDistanceFromHighway;
    }

    return buildRecommendationPropertyWhere({
      categoryId: mustHave?.categoryId,
      // Only strict must-have locations should narrow the candidate query.
      // Nearby/preferred locations stay in the scoring layer so we do not
      // exclude geographically relevant properties before ranking.
      location: mustHaveLocations[0],
      locations: mustHaveLocations,
      minPrice: inactivePreferenceScope.minPrice,
      maxPrice: mustHave?.maxPrice ?? inactivePreferenceScope.maxPrice,
      minRoi: mustHave?.minRoi ?? inactivePreferenceScope.minRoi,
      minArea: mustHave?.minArea ?? inactivePreferenceScope.minArea,
      maxArea:
        mustHave?.minArea === undefined
          ? inactivePreferenceScope.maxArea
          : undefined,
      maxDistanceFromHighway:
        mustHave?.maxDistanceFromHighway ??
        inactivePreferenceScope.maxDistanceFromHighway,
      status: mustHave?.status,
    });
  }

  buildRequestFromQuery(
    query: Record<string, unknown>,
  ): RecommendationRequestDto {
    const mustHaveLocations = getLocationNamesFromPayload({
      locations: [
        ...this.extractQueryStrings(query.mustHaveLocation),
        ...this.extractQueryStrings(query.mustHaveLocations),
      ],
    });
    const preferenceLocations = getLocationNamesFromPayload({
      locations: [
        ...this.extractQueryStrings(query.location),
        ...this.extractQueryStrings(query.locations),
        ...this.extractQueryStrings(query.preferredLocation),
        ...this.extractQueryStrings(query.preferredLocations),
      ],
    });
    const coordinates = [
      ...this.parseCoordinateList(query.coordinates),
      ...this.parseCoordinateList(query.coordinate),
    ];
    const legacyLatitude =
      this.parseNumber(query.latitude) ?? this.parseNumber(query.preferredLatitude);
    const legacyLongitude =
      this.parseNumber(query.longitude) ??
      this.parseNumber(query.preferredLongitude);
    const normalizedCoordinates =
      coordinates.length > 0
        ? coordinates
        : legacyLatitude !== undefined && legacyLongitude !== undefined
          ? [{ latitude: legacyLatitude, longitude: legacyLongitude }]
          : [];

    return {
      brief: this.extractQueryString(query.brief),
      mustHave: {
        categoryId: this.parseNumber(query.mustHaveCategoryId),
        category: this.extractQueryString(query.mustHaveCategory),
        location: mustHaveLocations[0],
        locations: mustHaveLocations,
        maxPrice: this.parseNumber(query.maxPrice),
        minRoi: this.parseNumber(query.minRoi),
        minArea: this.parseNumber(query.minArea),
        maxDistanceFromHighway: this.parseNumber(
          query.mustHaveMaxDistanceFromHighway,
        ),
        status: this.extractQueryString(query.mustHaveStatus) as
          | PropertyStatus
          | undefined,
      },
      preferences: {
        categoryId: this.parseNumber(query.categoryId),
        category: this.extractQueryString(query.category),
        location: preferenceLocations[0],
        locations: preferenceLocations,
        latitude: normalizedCoordinates[0]?.latitude,
        longitude: normalizedCoordinates[0]?.longitude,
        coordinates:
          normalizedCoordinates.length > 0 ? normalizedCoordinates : undefined,
        placeIds: [
          ...this.extractQueryStrings(query.placeId),
          ...this.extractQueryStrings(query.placeIds),
        ],
        locationRadiusKm: this.parseNumber(query.locationRadiusKm),
        price: this.parseNumber(query.price),
        roi:
          this.parseNumber(query.roi) ?? this.parseNumber(query.preferredRoi),
        area:
          this.parseNumber(query.area) ?? this.parseNumber(query.preferredArea),
        maxDistanceFromHighway:
          this.parseNumber(query.maxDistanceFromHighway) ??
          this.parseNumber(query.preferredMaxDistance),
        status: this.extractQueryString(query.status) as
          | PropertyStatus
          | undefined,
      },
      page: this.parseNumber(query.page),
      limit: this.parseNumber(query.limit),
    };
  }

  private async enrichLocationCoordinates(
    preferences: RecommendationPreferences,
  ): Promise<RecommendationPreferences> {
    const locations = getLocationNamesFromPayload(preferences);
    const coordinates = getCoordinatesFromPayload(preferences);

    if (locations.length === 0 || coordinates.length >= locations.length) {
      return preferences;
    }

    const geocodedLocations = await Promise.all(
      locations.map(async (location) => {
        const locationProfile = buildLocationSearchProfile(location);
        if (!locationProfile) {
          return null;
        }

        const coordinate = await geocodeLocation(locationProfile.value);
        return coordinate
          ? {
              latitude: coordinate.latitude,
              longitude: coordinate.longitude,
            }
          : null;
      }),
    );

    const nextCoordinates = geocodedLocations.filter(
      (coordinate): coordinate is { latitude: number; longitude: number } =>
        coordinate !== null,
    );

    return {
      ...preferences,
      location: locations[0] ?? preferences.location,
      locations,
      latitude: nextCoordinates[0]?.latitude ?? preferences.latitude,
      longitude: nextCoordinates[0]?.longitude ?? preferences.longitude,
      coordinates:
        nextCoordinates.length > 0 ? nextCoordinates : preferences.coordinates,
    };
  }

  private async buildRecommendationScoringContext(
    input: RecommendationRequestDto,
    context: { userId?: number } = {},
  ): Promise<RecommendationScoringContext> {
    const parsedQuery = await recommendationQueryParserService.parse(input);
    const weightResolution = await recommendationWeightService.resolveForUser(
      context.userId,
    );
    const weights = weightResolution.weights;
    const basePreferences = await this.enrichLocationCoordinates(
      parsedQuery.preferences,
    );
    const preferences = this.buildScoringPreferences(
      basePreferences,
      parsedQuery.mustHave,
    );

    return {
      parsedQuery,
      preferences,
      weights,
      meta: {
        appliedWeights: weights,
        isDefaultWeights: weightResolution.isDefault,
        weightSource: weightResolution.source,
        parsedBrief: {
          ...parsedQuery.parsedBrief,
          appliedPreferences: basePreferences,
        },
      },
    };
  }

  private async buildRankedRecommendationContext(
    input: RecommendationRequestDto,
    context: { userId?: number } = {},
  ): Promise<RankedRecommendationContext> {
    const scoringContext = await this.buildRecommendationScoringContext(
      input,
      context,
    );
    const { parsedQuery, preferences, weights } = scoringContext;
    const hasScoringPreferences = this.hasScoringPreferences(
      preferences,
      weights,
    );
    const candidateWhere = this.buildLocationScopedCandidateWhere(
      parsedQuery.mustHave,
      preferences,
      weights,
    );
    const hasScopedCandidates =
      Object.keys(candidateWhere).length > 0 ||
      Object.getOwnPropertySymbols(candidateWhere).length > 0;

    const candidates = await Property.findAll({
      where: candidateWhere,
      order: [["createdAt", "DESC"]],
      attributes: { exclude: ["created_at", "updated_at"] },
      include: [
        {
          model: Category,
          attributes: ["id", "name"],
        },
      ],
    });

    const visibilityOptions = {
      hasLocationPreference: this.hasLocationPreference(preferences, weights),
      hasScoringPreferences,
      minimumMatchPercentage: this.minimumRecommendationMatchPercentage,
      allowZeroMatchResults: !hasScoringPreferences && hasScopedCandidates,
    };

    const ranked = filterVisibleRecommendations(
      candidates.map<RecommendationResultDto>((property) => {
        const scored = scoreProperty(property, preferences, weights);

        return {
          property: serializePropertySummary(property),
          matchPercentage: scored.matchPercentage,
          score: scored.score,
          explanation: scored.explanation,
          rankingSummary: scored.rankingSummary,
          topReasons: scored.topReasons,
          penalties: scored.penalties,
          scoreBreakdown: scored.scoreBreakdown,
        };
      }),
      visibilityOptions,
    ).sort(
      (a, b) => b.score - a.score || b.matchPercentage - a.matchPercentage,
    );

    return {
      ranked,
      preferences,
      weights,
      meta: scoringContext.meta,
    };
  }

  async getRecommendations(
    input: RecommendationRequestDto,
    context: { userId?: number } = {},
  ): Promise<RecommendationServiceResponse> {
    const { page, limit } = this.normalizePagination(input.page, input.limit);
    const recommendationContext = await this.buildRankedRecommendationContext(
      input,
      context,
    );
    const shortlisted = recommendationContext.ranked.slice(
      0,
      this.topRecommendationLimit,
    );
    const total = shortlisted.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;

    return {
      data: shortlisted.slice(offset, offset + limit),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      meta: recommendationContext.meta,
    };
  }

  async getRecommendationDetail(
    propertyId: number,
    input: RecommendationRequestDto,
    context: { userId?: number } = {},
  ): Promise<RecommendationDetailDto> {
    const recommendationContext = await this.buildRecommendationScoringContext(
      input,
      context,
    );

    const property = await Property.findByPk(propertyId, {
      attributes: { exclude: ["created_at", "updated_at"] },
      include: [
        {
          model: Category,
          attributes: ["id", "name"],
        },
      ],
    });

    if (!property) {
      throw new AppError("Property not found", 404);
    }

    const scored = scoreProperty(
      property,
      recommendationContext.preferences,
      recommendationContext.weights,
    );

    return {
      property: serializePropertySummary(property),
      recommendation: {
        matchPercentage: scored.matchPercentage,
        score: scored.score,
        explanation: scored.explanation,
        rankingSummary: scored.rankingSummary,
        topReasons: scored.topReasons,
        penalties: scored.penalties,
        scoreBreakdown: scored.scoreBreakdown,
        rank: null,
      },
      meta: recommendationContext.meta,
    };
  }
}

export default new RecommendationService();
