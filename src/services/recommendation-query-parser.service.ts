import type {
  RecommendationMustHaveDto,
  RecommendationParsedBriefMetadataDto,
  RecommendationPreferencesDto,
  RecommendationRequestDto,
} from "@dto/recommendation.dto";
import { Category } from "@models/category.model";
import { normalizePropertyStatus } from "@constants/property";
import {
  resolveCategoryCandidate,
  type CategoryLike,
} from "@utils/nlp/category-parser";
import { parseRecommendationBrief } from "@utils/nlp/recommendation-brief-parser";

export interface ParsedRecommendationQueryResult {
  mustHave: RecommendationMustHaveDto;
  preferences: RecommendationPreferencesDto;
  parsedBrief: RecommendationParsedBriefMetadataDto;
}

type CategorySelection = {
  categoryId?: number;
  category?: string;
};

const omitUndefined = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, candidate]) => candidate !== undefined),
  ) as T;

export class RecommendationQueryParserService {
  private normalizeString(value?: string): string | undefined {
    const trimmed = value?.trim();
    return trimmed || undefined;
  }

  private normalizeNumber(value?: number): number | undefined {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return undefined;
    }

    return value;
  }

  private normalizePositiveNumber(value?: number): number | undefined {
    const normalized = this.normalizeNumber(value);
    if (normalized === undefined || normalized <= 0) {
      return undefined;
    }

    return normalized;
  }

  private normalizePositiveInteger(value?: number): number | undefined {
    const normalized = this.normalizeNumber(value);
    if (normalized === undefined) {
      return undefined;
    }

    const parsed = Math.trunc(normalized);
    return parsed > 0 ? parsed : undefined;
  }

  private sanitizeMustHave(
    input?: RecommendationMustHaveDto,
  ): RecommendationMustHaveDto {
    if (!input) {
      return {};
    }

    return omitUndefined({
      categoryId: this.normalizePositiveInteger(input.categoryId),
      category: this.normalizeString(input.category),
      location: this.normalizeString(input.location),
      maxPrice: this.normalizePositiveNumber(input.maxPrice),
      minRoi: this.normalizePositiveNumber(input.minRoi),
      minArea: this.normalizePositiveNumber(input.minArea),
      maxDistanceFromHighway: this.normalizePositiveNumber(
        input.maxDistanceFromHighway,
      ),
      status: input.status
        ? (normalizePropertyStatus(input.status) ?? undefined)
        : undefined,
    });
  }

  private sanitizePreferences(
    input?: RecommendationPreferencesDto,
  ): RecommendationPreferencesDto {
    if (!input) {
      return {};
    }

    return omitUndefined({
      categoryId: this.normalizePositiveInteger(input.categoryId),
      category: this.normalizeString(input.category),
      location: this.normalizeString(input.location),
      latitude: this.normalizeNumber(input.latitude),
      longitude: this.normalizeNumber(input.longitude),
      locationRadiusKm: this.normalizePositiveNumber(input.locationRadiusKm),
      price: this.normalizePositiveNumber(input.price),
      roi: this.normalizePositiveNumber(input.roi),
      area: this.normalizePositiveNumber(input.area),
      maxDistanceFromHighway: this.normalizePositiveNumber(
        input.maxDistanceFromHighway,
      ),
      status: input.status
        ? (normalizePropertyStatus(input.status) ?? undefined)
        : undefined,
    });
  }

  private removeParsedMustHavesOverriddenByPreferences(
    parsedMustHave: RecommendationMustHaveDto,
    manualMustHave: RecommendationMustHaveDto,
    manualPreferences: RecommendationPreferencesDto,
  ): RecommendationMustHaveDto {
    const next = { ...parsedMustHave };

    if (
      manualPreferences.location !== undefined &&
      manualMustHave.location === undefined
    ) {
      delete next.location;
    }

    if (
      (manualPreferences.categoryId !== undefined ||
        manualPreferences.category !== undefined) &&
      manualMustHave.categoryId === undefined &&
      manualMustHave.category === undefined
    ) {
      delete next.categoryId;
      delete next.category;
    }

    if (
      manualPreferences.price !== undefined &&
      manualMustHave.maxPrice === undefined
    ) {
      delete next.maxPrice;
    }

    if (
      manualPreferences.roi !== undefined &&
      manualMustHave.minRoi === undefined
    ) {
      delete next.minRoi;
    }

    if (
      manualPreferences.area !== undefined &&
      manualMustHave.minArea === undefined
    ) {
      delete next.minArea;
    }

    if (
      manualPreferences.maxDistanceFromHighway !== undefined &&
      manualMustHave.maxDistanceFromHighway === undefined
    ) {
      delete next.maxDistanceFromHighway;
    }

    if (
      manualPreferences.status !== undefined &&
      manualMustHave.status === undefined
    ) {
      delete next.status;
    }

    return omitUndefined(next);
  }

  private needsCategoryLookup(
    mustHave: RecommendationMustHaveDto,
    preferences: RecommendationPreferencesDto,
  ): boolean {
    return Boolean(
      mustHave.category ||
      mustHave.categoryId ||
      preferences.category ||
      preferences.categoryId,
    );
  }

  private async loadCategories(): Promise<CategoryLike[]> {
    const categories = await Category.findAll({
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
    });

    return categories.map((category) => ({
      id: Number(category.id),
      name: category.name,
    }));
  }

  private resolveCategorySelection<T extends CategorySelection>(
    input: T,
    categories: CategoryLike[],
    warnings: string[],
    sourceLabel: string,
  ): T {
    if (!input.category && input.categoryId === undefined) {
      return input;
    }

    const next = { ...input };

    if (next.categoryId !== undefined) {
      const resolvedById = categories.find(
        (category) => category.id === next.categoryId,
      );
      if (resolvedById) {
        next.category = resolvedById.name;
      }
      return omitUndefined(next) as T;
    }

    if (next.category) {
      const resolvedCategory = resolveCategoryCandidate(
        next.category,
        categories,
      );
      if (resolvedCategory) {
        next.categoryId = resolvedCategory.id;
        next.category = resolvedCategory.name;
        return omitUndefined(next) as T;
      }

      warnings.push(
        `Could not resolve ${sourceLabel} category "${next.category}", so category matching was skipped.`,
      );
      delete next.category;
    }

    return omitUndefined(next) as T;
  }

  async parse(
    input: RecommendationRequestDto,
  ): Promise<ParsedRecommendationQueryResult> {
    const brief = this.normalizeString(input.brief);
    const parsedBrief = parseRecommendationBrief(brief);
    const manualMustHave = this.sanitizeMustHave(input.mustHave);
    const manualPreferences = this.sanitizePreferences(input.preferences);

    // Manual structured inputs should win over any parser-derived filter in the
    // same domain so the current form remains predictable during Phase 1.
    const parsedMustHaveForMerge =
      this.removeParsedMustHavesOverriddenByPreferences(
        this.sanitizeMustHave(parsedBrief.mustHave),
        manualMustHave,
        manualPreferences,
      );

    let appliedFilters = this.sanitizeMustHave({
      ...parsedMustHaveForMerge,
      ...manualMustHave,
    });
    let appliedPreferences = this.sanitizePreferences({
      ...this.sanitizePreferences(parsedBrief.preferences),
      ...manualPreferences,
    });

    const warnings = [...parsedBrief.warnings];

    if (this.needsCategoryLookup(appliedFilters, appliedPreferences)) {
      const categories = await this.loadCategories();
      appliedFilters = this.resolveCategorySelection(
        appliedFilters,
        categories,
        warnings,
        brief ? "brief" : "request",
      );
      appliedPreferences = this.resolveCategorySelection(
        appliedPreferences,
        categories,
        warnings,
        brief ? "brief" : "request",
      );
    }

    return {
      mustHave: appliedFilters,
      preferences: appliedPreferences,
      parsedBrief: {
        brief,
        detectedEntities: parsedBrief.detectedEntities,
        detectedLocation: parsedBrief.detectedLocation,
        detectedLocations: parsedBrief.detectedLocations,
        parsedMustHave: this.sanitizeMustHave(parsedBrief.mustHave),
        parsedPreferences: this.sanitizePreferences(parsedBrief.preferences),
        appliedFilters,
        appliedPreferences,
        warnings,
      },
    };
  }
}

export default new RecommendationQueryParserService();
