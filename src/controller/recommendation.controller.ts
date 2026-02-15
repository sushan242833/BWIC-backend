import { Request, Response } from "express";
import { Op, WhereOptions } from "sequelize";
import { Category } from "@models/category.model";
import { Property } from "@models/properties.model";
import {
  applyHardFilters,
  RecommendationMustHave,
  RecommendationPreferences,
  scoreProperty,
} from "@utils/recommendation";
import { geocodeLocation } from "@utils/geocoding";

interface RecommendationRequestBody {
  mustHave?: RecommendationMustHave;
  preferences?: RecommendationPreferences;
  page?: number;
  limit?: number;
}

export class RecommendationController {
  private extractQueryString(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      const first = value[0];
      return typeof first === "string" ? first : undefined;
    }
    return undefined;
  }

  private parseNumber(value: unknown): number | undefined {
    if (typeof value === "number") return Number.isNaN(value) ? undefined : value;

    const raw = this.extractQueryString(value);
    if (!raw) return undefined;

    const parsed = Number.parseFloat(raw.replace(/,/g, "").trim());
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private buildFromQuery(req: Request): RecommendationRequestBody {
    return {
      mustHave: {
        location: this.extractQueryString(req.query.location),
        categoryId: this.parseNumber(req.query.categoryId),
        minPrice: this.parseNumber(req.query.minPrice),
        maxPrice: this.parseNumber(req.query.maxPrice),
        minRoi: this.parseNumber(req.query.minRoi),
        minArea: this.parseNumber(req.query.minArea),
        maxDistanceFromHighway: this.parseNumber(req.query.maxDistanceFromHighway),
        status: this.extractQueryString(req.query.status),
      },
      preferences: {
        location: this.extractQueryString(req.query.preferredLocation),
        latitude: this.parseNumber(req.query.preferredLatitude),
        longitude: this.parseNumber(req.query.preferredLongitude),
        locationRadiusKm: this.parseNumber(req.query.locationRadiusKm),
        budget: this.parseNumber(req.query.budget),
        roiPercent: this.parseNumber(req.query.preferredRoi),
        areaSqft: this.parseNumber(req.query.preferredArea),
        maxDistanceFromHighway: this.parseNumber(req.query.preferredMaxDistance),
      },
      page: this.parseNumber(req.query.page),
      limit: this.parseNumber(req.query.limit),
    };
  }

  private sanitizeMustHave(input?: RecommendationMustHave): RecommendationMustHave {
    if (!input) return {};

    return {
      location: input.location?.trim() || undefined,
      categoryId: this.parseNumber(input.categoryId),
      minPrice: this.parseNumber(input.minPrice),
      maxPrice: this.parseNumber(input.maxPrice),
      minRoi: this.parseNumber(input.minRoi),
      minArea: this.parseNumber(input.minArea),
      maxDistanceFromHighway: this.parseNumber(input.maxDistanceFromHighway),
      status: input.status?.trim() || undefined,
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
      budget: this.parseNumber(input.budget),
      roiPercent: this.parseNumber(input.roiPercent),
      areaSqft: this.parseNumber(input.areaSqft),
      maxDistanceFromHighway: this.parseNumber(input.maxDistanceFromHighway),
    };
  }

  async getRecommendations(req: Request, res: Response) {
    try {
      const source = req.method === "GET" ? this.buildFromQuery(req) : (req.body as RecommendationRequestBody);

      const mustHave = this.sanitizeMustHave(source.mustHave);
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
      const limit = Math.min(50, Math.max(1, Math.trunc(source.limit || 20)));

      if (
        mustHave.minPrice !== undefined &&
        mustHave.maxPrice !== undefined &&
        mustHave.minPrice > mustHave.maxPrice
      ) {
        return res.status(400).json({
          message: "Invalid constraints: minPrice cannot be greater than maxPrice",
        });
      }

      const where: WhereOptions = {};

      if (mustHave.location) {
        where.location = { [Op.iLike]: `%${mustHave.location}%` };
      }

      if (mustHave.categoryId !== undefined) {
        where.categoryId = mustHave.categoryId;
      }

      if (mustHave.status) {
        where.status = { [Op.iLike]: mustHave.status };
      }

      if (mustHave.minPrice !== undefined) {
        where.priceNpr = { ...(where.priceNpr as object), [Op.gte]: mustHave.minPrice };
      }

      if (mustHave.maxPrice !== undefined) {
        where.priceNpr = { ...(where.priceNpr as object), [Op.lte]: mustHave.maxPrice };
      }

      if (mustHave.minRoi !== undefined) {
        where.roiPercent = { ...(where.roiPercent as object), [Op.gte]: mustHave.minRoi };
      }

      if (mustHave.minArea !== undefined) {
        where.areaSqft = { ...(where.areaSqft as object), [Op.gte]: mustHave.minArea };
      }

      if (mustHave.maxDistanceFromHighway !== undefined) {
        where.distanceFromHighway = {
          ...(where.distanceFromHighway as object),
          [Op.lte]: mustHave.maxDistanceFromHighway,
        };
      }

      const candidates = await Property.findAll({
        where,
        attributes: { exclude: ["created_at", "updated_at"] },
        include: [
          {
            model: Category,
            attributes: ["id", "name"],
          },
        ],
      });

      const hardFiltered = applyHardFilters(candidates, mustHave);

      const ranked = hardFiltered
        .map((property) => {
          const scored = scoreProperty(property, preferences);
          return {
            property,
            matchPercentage: scored.matchPercentage,
            score: scored.score,
            explanation: scored.explanation,
          };
        })
        .sort((a, b) => b.score - a.score || b.matchPercentage - a.matchPercentage);

      const total = ranked.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const offset = (page - 1) * limit;
      const data = ranked.slice(offset, offset + limit);

      return res.status(200).json({
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
      console.error("Failed to build recommendations:", error);
      return res.status(500).json({
        message: "Failed to build recommendations",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export default new RecommendationController();
