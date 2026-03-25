import { NextFunction, Request, Response } from "express";
import { recommendationConfig } from "@config/recommendation";
import { Category } from "@models/category.model";
import {
  RecommendationRequestDto,
  RecommendationResultDto,
} from "@dto/recommendation.dto";
import { Property } from "@models/properties.model";
import {
  RecommendationPreferences,
  scoreProperty,
} from "@utils/recommendation";
import { geocodeLocation } from "@utils/geocoding";
import { sendSuccess } from "@utils/api-response";
import { serializePropertySummary } from "@utils/property-serializers";

export class RecommendationController {
  private readonly topRecommendationLimit =
    recommendationConfig.topRecommendationLimit;
  private readonly minimumRecommendationMatchPercentage =
    recommendationConfig.minimumMatchPercentage;
  private readonly defaultRecommendationPageSize =
    recommendationConfig.defaultPageSize;
  private readonly maxRecommendationPageSize =
    recommendationConfig.maxPageSize;

  private hasLocationPreference(preferences: RecommendationPreferences): boolean {
    return (
      Boolean(preferences.location) ||
      (preferences.latitude !== undefined && preferences.longitude !== undefined)
    );
  }

  private extractQueryString(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      const first = value[0];
      return typeof first === "string" ? first : undefined;
    }
    return undefined;
  }

  private parseNumber(value: unknown): number | undefined {
    if (typeof value === "number")
      return Number.isNaN(value) ? undefined : value;

    const raw = this.extractQueryString(value);
    if (!raw) return undefined;

    const parsed = Number.parseFloat(raw.replace(/,/g, "").trim());
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private buildFromQuery(req: Request): RecommendationRequestDto {
    return {
      preferences: {
        location:
          this.extractQueryString(req.query.location) ||
          this.extractQueryString(req.query.preferredLocation),
        latitude:
          this.parseNumber(req.query.latitude) ??
          this.parseNumber(req.query.preferredLatitude),
        longitude:
          this.parseNumber(req.query.longitude) ??
          this.parseNumber(req.query.preferredLongitude),
        locationRadiusKm: this.parseNumber(req.query.locationRadiusKm),
        price: this.parseNumber(req.query.price),
        roi:
          this.parseNumber(req.query.roi) ??
          this.parseNumber(req.query.preferredRoi),
        area:
          this.parseNumber(req.query.area) ??
          this.parseNumber(req.query.preferredArea),
        maxDistanceFromHighway:
          this.parseNumber(req.query.maxDistanceFromHighway) ??
          this.parseNumber(req.query.preferredMaxDistance),
      },
      page: this.parseNumber(req.query.page),
      limit: this.parseNumber(req.query.limit),
    };
  }

  private sanitizePreferences(
    input?: RecommendationPreferences,
  ): RecommendationPreferences {
    if (!input) return {};

    return {
      location: input.location?.trim() || undefined,
      latitude: this.parseNumber(input.latitude),
      longitude: this.parseNumber(input.longitude),
      locationRadiusKm: this.parseNumber(input.locationRadiusKm),
      price: this.parseNumber(input.price),
      roi: this.parseNumber(input.roi),
      area: this.parseNumber(input.area),
      maxDistanceFromHighway: this.parseNumber(input.maxDistanceFromHighway),
    };
  }

  async getRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const source =
        req.method === "GET"
          ? this.buildFromQuery(req)
          : (req.body as RecommendationRequestDto);

      const preferences = this.sanitizePreferences(source.preferences);

      if (
        preferences.location &&
        (preferences.latitude === undefined ||
          preferences.longitude === undefined)
      ) {
        const coordinates = await geocodeLocation(preferences.location);
        if (coordinates) {
          preferences.latitude = coordinates.latitude;
          preferences.longitude = coordinates.longitude;
        }
      }

      const page = Math.max(1, Math.trunc(source.page || 1));
      const limit = Math.min(
        this.maxRecommendationPageSize,
        Math.max(1, Math.trunc(source.limit || this.defaultRecommendationPageSize)),
      );

      const candidates = await Property.findAll({
        attributes: { exclude: ["created_at", "updated_at"] },
        include: [
          {
            model: Category,
            attributes: ["id", "name"],
          },
        ],
      });

      const ranked = candidates
        .map<RecommendationResultDto>((property) => {
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
        })
        .filter(
          (item) =>
            !this.hasLocationPreference(preferences) ||
            (item.scoreBreakdown?.location ?? 0) > 0,
        )
        .filter(
          (item) =>
            item.matchPercentage >= this.minimumRecommendationMatchPercentage,
        )
        .sort(
          (a, b) => b.score - a.score || b.matchPercentage - a.matchPercentage,
        );

      const shortlisted = ranked.slice(0, this.topRecommendationLimit);

      const total = shortlisted.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const offset = (page - 1) * limit;
      const data = shortlisted.slice(offset, offset + limit);

      return sendSuccess(res, {
        message: "Top recommendations fetched successfully",
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new RecommendationController();
