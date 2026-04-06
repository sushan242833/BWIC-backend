import { recommendationConfig } from "@config/recommendation";
import type { PropertyStatus } from "@constants/property";
import type {
  RecommendationRequestDto,
  RecommendationResponseMetaDto,
  RecommendationResultDto,
} from "@dto/recommendation.dto";
import { Category } from "@models/category.model";
import { Property } from "@models/properties.model";
import recommendationQueryParserService from "@services/recommendation-query-parser.service";
import type { PaginationMeta } from "@utils/api-response";
import { geocodeLocation } from "@utils/geocoding";
import { serializePropertySummary } from "@utils/property-serializers";
import {
  buildRecommendationPropertyWhere,
  type RecommendationPropertyFilterQuery,
} from "@utils/property-filters";
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
): RecommendationResultDto[] =>
  items
    .filter((item) => item.matchPercentage > 0)
    .filter(
      (item) =>
        !options.hasLocationPreference ||
        (item.scoreBreakdown?.location ?? 0) > 0,
    )
    .filter(
      (item) =>
        !options.hasScoringPreferences ||
        item.matchPercentage >= options.minimumMatchPercentage,
    );

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
  ): boolean {
    return (
      Boolean(preferences.location) ||
      (preferences.latitude !== undefined &&
        preferences.longitude !== undefined)
    );
  }

  private hasScoringPreferences(
    preferences: RecommendationPreferences,
  ): boolean {
    return Boolean(
      preferences.location ||
      (preferences.latitude !== undefined &&
        preferences.longitude !== undefined) ||
      (preferences.price !== undefined && preferences.price > 0) ||
      (preferences.roi !== undefined && preferences.roi > 0) ||
      (preferences.area !== undefined && preferences.area > 0) ||
      (preferences.maxDistanceFromHighway !== undefined &&
        preferences.maxDistanceFromHighway > 0),
    );
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

  private buildFilterQuery(
    mustHave: RecommendationRequestDto["mustHave"],
  ): RecommendationPropertyFilterQuery {
    return {
      location: mustHave?.location,
      categoryId: mustHave?.categoryId,
      maxPrice: mustHave?.maxPrice,
      minRoi: mustHave?.minRoi,
      minArea: mustHave?.minArea,
      maxDistanceFromHighway: mustHave?.maxDistanceFromHighway,
      status: mustHave?.status,
    };
  }

  async getRecommendations(
    input: RecommendationRequestDto,
  ): Promise<RecommendationServiceResponse> {
    const { page, limit } = this.normalizePagination(input.page, input.limit);
    const parsedQuery = await recommendationQueryParserService.parse(input);
    const preferences = await this.enrichLocationCoordinates(
      parsedQuery.preferences,
    );
    const hasScoringPreferences = this.hasScoringPreferences(preferences);
    const filterQuery = this.buildFilterQuery(parsedQuery.mustHave);

    const candidates = await Property.findAll({
      where: buildRecommendationPropertyWhere(filterQuery),
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
      hasLocationPreference: this.hasLocationPreference(preferences),
      hasScoringPreferences,
      minimumMatchPercentage: this.minimumRecommendationMatchPercentage,
    };

    const ranked = filterVisibleRecommendations(
      candidates.map<RecommendationResultDto>((property) => {
        const scored = scoreProperty(property, preferences);

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
    )
      .sort(
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
        parsedBrief: {
          ...parsedQuery.parsedBrief,
          appliedPreferences: preferences,
        },
      },
    };
  }
}

export default new RecommendationService();
