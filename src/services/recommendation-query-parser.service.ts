import type {
  RecommendationAIExtractionDto,
  RecommendationDetectedEntityDto,
  RecommendationDetectedLocationDto,
  RecommendationExtractionSource,
  RecommendationLocationMode,
  RecommendationMustHaveDto,
  RecommendationParsedBriefMetadataDto,
  RecommendationPreferencesDto,
  RecommendationRequestDto,
} from "@dto/recommendation.dto";
import { Category } from "@models/category.model";
import { normalizePropertyStatus } from "@constants/property";
import aiQueryUnderstandingService from "@services/ai-query-understanding.service";
import {
  parseCategoryCandidate,
  resolveCategoryCandidate,
  type CategoryLike,
} from "@utils/nlp/category-parser";
import {
  buildLocationSearchProfile,
  type LocationSearchProfile,
} from "@utils/nlp/location-parser";
import { parseRecommendationBrief } from "@utils/nlp/recommendation-brief-parser";
import type { AIRecommendationExtraction } from "@utils/ai/recommendation-ai-schema";

export interface ParsedRecommendationQueryResult {
  mustHave: RecommendationMustHaveDto;
  preferences: RecommendationPreferencesDto;
  parsedBrief: RecommendationParsedBriefMetadataDto;
}

type CategorySelection = {
  categoryId?: number;
  category?: string;
};

interface RecommendationParsedBriefSource {
  mustHave: RecommendationMustHaveDto;
  preferences: RecommendationPreferencesDto;
  detectedEntities: RecommendationDetectedEntityDto[];
  detectedLocation?: RecommendationDetectedLocationDto;
  detectedLocations: RecommendationDetectedLocationDto[];
  warnings: string[];
  extractionSource?: RecommendationExtractionSource;
  extractionConfidence?: number;
  locationMode?: RecommendationLocationMode;
  aiExtraction?: RecommendationAIExtractionDto;
}

interface RecommendationQueryParserDependencies {
  aiQueryUnderstandingService?: Pick<
    typeof aiQueryUnderstandingService,
    "extractRecommendationQuery"
  >;
  categoryLoader?: () => Promise<CategoryLike[]>;
}

const omitUndefined = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, candidate]) => candidate !== undefined),
  ) as T;

export class RecommendationQueryParserService {
  private readonly aiQueryUnderstandingService: Pick<
    typeof aiQueryUnderstandingService,
    "extractRecommendationQuery"
  >;
  private readonly categoryLoader?: () => Promise<CategoryLike[]>;

  constructor(dependencies: RecommendationQueryParserDependencies = {}) {
    this.aiQueryUnderstandingService =
      dependencies.aiQueryUnderstandingService ?? aiQueryUnderstandingService;
    this.categoryLoader = dependencies.categoryLoader;
  }

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
    if (this.categoryLoader) {
      return this.categoryLoader();
    }
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

  private pushDetectedEntity(
    entities: RecommendationDetectedEntityDto[],
    entity: RecommendationDetectedEntityDto,
  ) {
    const exists = entities.some(
      (current) =>
        current.type === entity.type &&
        current.raw === entity.raw &&
        current.value === entity.value,
    );

    if (!exists) {
      entities.push(entity);
    }
  }

  private buildLocationMatchReason(mode: RecommendationLocationMode): string {
    if (mode === "strict") {
      return "AI detected a direct location filter from the query wording.";
    }

    if (mode === "nearby") {
      return "AI detected a nearby or proximity-based location preference.";
    }

    return "AI detected a softer location preference from the free-text brief.";
  }

  private buildDetectedLocation(
    profile: LocationSearchProfile,
    raw: string,
    mode: RecommendationLocationMode,
    confidence?: number,
  ): RecommendationDetectedLocationDto {
    const normalizedConfidence =
      confidence === undefined
        ? undefined
        : Math.max(0.45, Math.min(0.99, Math.round(confidence * 100) / 100));

    return {
      raw,
      value: profile.value,
      normalizedValue: profile.normalizedValue,
      aliases: profile.aliases,
      mode,
      confidence: normalizedConfidence ?? (mode === "strict" ? 0.9 : 0.82),
      matchReason: this.buildLocationMatchReason(mode),
    };
  }

  private mapAIExtractionToParsedBrief(
    extraction: AIRecommendationExtraction,
  ): RecommendationParsedBriefSource {
    const detectedEntities: RecommendationDetectedEntityDto[] = [];
    const mapped: RecommendationParsedBriefSource = {
      mustHave: {},
      preferences: {},
      detectedEntities,
      detectedLocations: [],
      warnings: [],
      extractionSource: "ai",
      extractionConfidence: extraction.confidence,
      aiExtraction: extraction,
    };

    const categoryInput = this.normalizeString(extraction.category);
    if (categoryInput) {
      const parsedCategory = parseCategoryCandidate(categoryInput);
      const categoryValue = parsedCategory?.canonical || categoryInput;
      mapped.mustHave.category = categoryValue;
      this.pushDetectedEntity(detectedEntities, {
        type: "category",
        value: categoryValue,
        raw: categoryInput,
      });
    }

    const locationValue =
      this.normalizeString(extraction.location?.value) ||
      this.normalizeString(extraction.landmarkPreference);
    const locationMode =
      extraction.location?.mode || (locationValue ? "nearby" : undefined);

    if (locationValue && locationMode) {
      const locationProfile = buildLocationSearchProfile(locationValue);
      if (locationProfile) {
        const detectedLocation = this.buildDetectedLocation(
          locationProfile,
          locationValue,
          locationMode,
          extraction.location?.confidence ?? extraction.confidence,
        );

        mapped.detectedLocation = detectedLocation;
        mapped.detectedLocations = [detectedLocation];
        mapped.locationMode = detectedLocation.mode;

        if (detectedLocation.mode === "strict") {
          mapped.mustHave.location = detectedLocation.value;
          mapped.preferences.location = detectedLocation.value;
        } else {
          mapped.preferences.location = detectedLocation.value;
        }

        this.pushDetectedEntity(detectedEntities, {
          type: "location",
          value: detectedLocation.value,
          raw: locationValue,
        });
      }
    }

    if (extraction.maxPrice !== undefined) {
      mapped.mustHave.maxPrice = extraction.maxPrice;
      this.pushDetectedEntity(detectedEntities, {
        type: "maxPrice",
        value: extraction.maxPrice,
        raw: String(extraction.maxPrice),
      });
    }

    if (extraction.minPrice !== undefined) {
      this.pushDetectedEntity(detectedEntities, {
        type: "minPrice",
        value: extraction.minPrice,
        raw: String(extraction.minPrice),
      });
    }

    if (extraction.bedrooms !== undefined) {
      this.pushDetectedEntity(detectedEntities, {
        type: "bedrooms",
        value: extraction.bedrooms,
        raw: String(extraction.bedrooms),
      });
    }

    if (extraction.bathrooms !== undefined) {
      this.pushDetectedEntity(detectedEntities, {
        type: "bathrooms",
        value: extraction.bathrooms,
        raw: String(extraction.bathrooms),
      });
    }

    if (extraction.parking !== undefined) {
      this.pushDetectedEntity(detectedEntities, {
        type: "parking",
        value: extraction.parking,
        raw: String(extraction.parking),
      });
    }

    if (extraction.furnished !== undefined) {
      this.pushDetectedEntity(detectedEntities, {
        type: "furnished",
        value: extraction.furnished,
        raw: String(extraction.furnished),
      });
    }

    if (extraction.minArea !== undefined) {
      mapped.mustHave.minArea = extraction.minArea;
      mapped.preferences.area = mapped.preferences.area ?? extraction.minArea;
      this.pushDetectedEntity(detectedEntities, {
        type: "minArea",
        value: extraction.minArea,
        raw: String(extraction.minArea),
      });
    }

    if (extraction.preferredArea !== undefined) {
      mapped.preferences.area = extraction.preferredArea;
      this.pushDetectedEntity(detectedEntities, {
        type: "preferredArea",
        value: extraction.preferredArea,
        raw: String(extraction.preferredArea),
      });
    }

    if (extraction.minRoi !== undefined) {
      mapped.mustHave.minRoi = extraction.minRoi;
      mapped.preferences.roi = mapped.preferences.roi ?? extraction.minRoi;
      this.pushDetectedEntity(detectedEntities, {
        type: "minRoi",
        value: extraction.minRoi,
        raw: String(extraction.minRoi),
      });
    }

    if (extraction.preferredRoi !== undefined) {
      mapped.preferences.roi = extraction.preferredRoi;
      this.pushDetectedEntity(detectedEntities, {
        type: "preferredRoi",
        value: extraction.preferredRoi,
        raw: String(extraction.preferredRoi),
      });
    }

    if (extraction.maxDistanceFromHighway !== undefined) {
      mapped.mustHave.maxDistanceFromHighway = extraction.maxDistanceFromHighway;
      mapped.preferences.maxDistanceFromHighway =
        extraction.maxDistanceFromHighway;
      this.pushDetectedEntity(detectedEntities, {
        type: "maxDistanceFromHighway",
        value: extraction.maxDistanceFromHighway,
        raw: String(extraction.maxDistanceFromHighway),
      });
    }

    const landmark = this.normalizeString(extraction.landmarkPreference);
    if (landmark) {
      this.pushDetectedEntity(detectedEntities, {
        type: "landmark",
        value: landmark,
        raw: landmark,
      });
    }

    const normalizedStatus = extraction.status
      ? normalizePropertyStatus(extraction.status)
      : undefined;
    if (normalizedStatus) {
      mapped.mustHave.status = normalizedStatus;
      this.pushDetectedEntity(detectedEntities, {
        type: "status",
        value: normalizedStatus,
        raw: extraction.status!,
      });
    }

    return mapped;
  }

  private async parseBriefWithAI(
    brief?: string,
  ): Promise<RecommendationParsedBriefSource | null> {
    const normalizedBrief = this.normalizeString(brief);
    if (!normalizedBrief) {
      return null;
    }

    const aiResult =
      await this.aiQueryUnderstandingService.extractRecommendationQuery(
        normalizedBrief,
      );

    if (!aiResult) {
      return null;
    }

    return this.mapAIExtractionToParsedBrief(aiResult.extraction);
  }

  private parseBriefWithFallback(
    brief?: string,
  ): RecommendationParsedBriefSource | null {
    const normalizedBrief = this.normalizeString(brief);
    if (!normalizedBrief) {
      return null;
    }

    const fallbackResult = parseRecommendationBrief(normalizedBrief);

    return {
      mustHave: fallbackResult.mustHave,
      preferences: fallbackResult.preferences,
      detectedEntities: fallbackResult.detectedEntities,
      detectedLocation: fallbackResult.detectedLocation,
      detectedLocations: fallbackResult.detectedLocations,
      warnings: fallbackResult.warnings,
      extractionSource: "rule_based_fallback",
      locationMode: fallbackResult.detectedLocation?.mode,
    };
  }

  private buildEmptyParsedBrief(
    brief?: string,
  ): RecommendationParsedBriefSource {
    const normalizedBrief = this.normalizeString(brief);
    return {
      mustHave: {},
      preferences: {},
      detectedEntities: [],
      detectedLocations: [],
      warnings: normalizedBrief
        ? [
            "Free-text brief was ignored because AI extraction did not return a usable result.",
          ]
        : [],
    };
  }

  async parse(
    input: RecommendationRequestDto,
  ): Promise<ParsedRecommendationQueryResult> {
    const brief = this.normalizeString(input.brief);
    const aiParsedBrief = await this.parseBriefWithAI(brief);
    const fallbackParsedBrief = aiParsedBrief
      ? null
      : this.parseBriefWithFallback(brief);
    const parsedBrief =
      aiParsedBrief ??
      fallbackParsedBrief ??
      this.buildEmptyParsedBrief(brief);
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
        extractionSource: parsedBrief.extractionSource,
        extractionConfidence: parsedBrief.extractionConfidence,
        locationMode: parsedBrief.locationMode,
        detectedEntities: parsedBrief.detectedEntities,
        detectedLocation: parsedBrief.detectedLocation,
        detectedLocations: parsedBrief.detectedLocations,
        aiExtraction: parsedBrief.aiExtraction,
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
