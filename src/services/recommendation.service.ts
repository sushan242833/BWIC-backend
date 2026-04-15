import { recommendationConfig } from "@config/recommendation";
import type { PropertyStatus } from "@constants/property";
import type { RecommendationWeights } from "@constants/recommendation-weights";
import type {
  RecommendationRequestDto,
  RecommendationResponseMetaDto,
  RecommendationResultDto,
} from "@dto/recommendation.dto";
import { Category } from "@models/category.model";
import { Property } from "@models/properties.model";
import recommendationQueryParserService from "@services/recommendation-query-parser.service";
import recommendationWeightService from "@services/recommendation-weight.service";
import type { PaginationMeta } from "@utils/api-response";
import { geocodeLocation } from "@utils/geocoding";
import { buildRecommendationPropertyWhere } from "@utils/property-filters";
import { serializePropertySummary } from "@utils/property-serializers";
import {
  RecommendationPreferences,
  scoreProperty,
} from "@utils/recommendation";
import { buildLocationSearchProfile } from "@utils/nlp/location-parser";

export interface RecommendationServiceResponse {
  data: RecommendationResultDto[];
  pagination: PaginationMeta;
  meta: RecommendationResponseMetaDto;
}

interface RecommendationVisibilityOptions {
  hasLocationPreference: boolean;
  hasScoringPreferences: boolean;
  minimumMatchPercentage: number;
}

export const filterVisibleRecommendations = (
  items: RecommendationResultDto[],
  options: RecommendationVisibilityOptions,
): RecommendationResultDto[] => {
  let visibleItems = items.filter((item) => item.matchPercentage > 0);

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
        (preferences.location ||
          (preferences.latitude !== undefined &&
            preferences.longitude !== undefined)),
    );
  }

  private hasScoringPreferences(
    preferences: RecommendationPreferences,
    weights: RecommendationWeights,
  ): boolean {
    return Boolean(
      (weights.location > 0 &&
        (preferences.location ||
          (preferences.latitude !== undefined &&
            preferences.longitude !== undefined))) ||
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
    return {
      ...preferences,
      location: preferences.location ?? mustHave?.location,
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

  private buildCandidateWhere(mustHave: RecommendationRequestDto["mustHave"]) {
    return buildRecommendationPropertyWhere({
      categoryId: mustHave?.categoryId,
      location: mustHave?.location,
      maxPrice: mustHave?.maxPrice,
      minRoi: mustHave?.minRoi,
      minArea: mustHave?.minArea,
      maxDistanceFromHighway: mustHave?.maxDistanceFromHighway,
      status: mustHave?.status,
    });
  }

  buildRequestFromQuery(
    query: Record<string, unknown>,
  ): RecommendationRequestDto {
    return {
      brief: this.extractQueryString(query.brief),
      mustHave: {
        categoryId: this.parseNumber(query.mustHaveCategoryId),
        category: this.extractQueryString(query.mustHaveCategory),
        location: this.extractQueryString(query.mustHaveLocation),
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
        location:
          this.extractQueryString(query.location) ||
          this.extractQueryString(query.preferredLocation),
        latitude:
          this.parseNumber(query.latitude) ??
          this.parseNumber(query.preferredLatitude),
        longitude:
          this.parseNumber(query.longitude) ??
          this.parseNumber(query.preferredLongitude),
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
    if (
      !preferences.location ||
      (preferences.latitude !== undefined &&
        preferences.longitude !== undefined)
    ) {
      return preferences;
    }

    const locationProfile = buildLocationSearchProfile(preferences.location);
    if (!locationProfile) {
      return preferences;
    }

    const coordinates = await geocodeLocation(locationProfile.value);
    if (!coordinates) {
      return {
        ...preferences,
        location: locationProfile.value,
      };
    }

    return {
      ...preferences,
      location: locationProfile.value,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    };
  }

  async getRecommendations(
    input: RecommendationRequestDto,
    context: { userId?: number } = {},
  ): Promise<RecommendationServiceResponse> {
    const { page, limit } = this.normalizePagination(input.page, input.limit);
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
    const hasScoringPreferences = this.hasScoringPreferences(
      preferences,
      weights,
    );
    const candidateWhere = this.buildCandidateWhere(parsedQuery.mustHave);

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

    const shortlisted = ranked.slice(0, this.topRecommendationLimit);
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
      meta: {
        appliedWeights: weights,
        parsedBrief: {
          ...parsedQuery.parsedBrief,
          appliedPreferences: basePreferences,
        },
      },
    };
  }
}

export default new RecommendationService();
