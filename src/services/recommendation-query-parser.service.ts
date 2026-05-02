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
import { AREA_UNIT_PATTERN_SOURCE } from "@utils/nlp/number-parser";
import {
  isGenericCategoryCandidate,
  parseCategoryCandidate,
  resolveCategoryCandidate,
  type CategoryLike,
} from "@utils/nlp/category-parser";
import { parseRecommendationBrief } from "@utils/nlp/recommendation-brief-parser";
import {
  buildLocationSearchProfile,
  type LocationSearchProfile,
} from "@utils/nlp/location-parser";
import {
  getCoordinatesFromPayload,
  getLocationNamesFromPayload,
} from "@utils/recommendation-locations";
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

    const locations = getLocationNamesFromPayload(input);

    return omitUndefined({
      categoryId: this.normalizePositiveInteger(input.categoryId),
      category: this.normalizeString(input.category),
      location: locations[0],
      locations: locations.length > 0 ? locations : undefined,
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

    const locations = getLocationNamesFromPayload(input);
    const coordinates = getCoordinatesFromPayload(input);

    return omitUndefined({
      categoryId: this.normalizePositiveInteger(input.categoryId),
      category: this.normalizeString(input.category),
      location: locations[0],
      locations: locations.length > 0 ? locations : undefined,
      latitude: this.normalizeNumber(coordinates[0]?.latitude),
      longitude: this.normalizeNumber(coordinates[0]?.longitude),
      coordinates: coordinates.length > 0 ? coordinates : undefined,
      placeIds:
        input.placeIds && input.placeIds.length > 0 ? input.placeIds : undefined,
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
    const hasManualPreferenceLocation =
      manualPreferences.location !== undefined ||
      (manualPreferences.locations !== undefined &&
        manualPreferences.locations.length > 0);
    const hasManualMustHaveLocation =
      manualMustHave.location !== undefined ||
      (manualMustHave.locations !== undefined &&
        manualMustHave.locations.length > 0);

    if (hasManualPreferenceLocation && !hasManualMustHaveLocation) {
      delete next.location;
      delete next.locations;
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
      if (isGenericCategoryCandidate(next.category)) {
        delete next.category;
        return omitUndefined(next) as T;
      }

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

  private hasApproximateAreaPreference(brief?: string): boolean {
    if (!brief) {
      return false;
    }

    return new RegExp(
      `\\b(?:around|about|approximately|approx(?:imately)?|roughly|ideal(?:ly)?|target(?: area)?|preferred(?: area)?)\\s*\\d[\\d,]*(?:\\.\\d+)?\\s*(?:${AREA_UNIT_PATTERN_SOURCE})\\b`,
      "i",
    ).test(brief);
  }

  private normalizeAIAreaSemantics(
    brief: string | undefined,
    extraction: AIRecommendationExtraction,
  ): AIRecommendationExtraction {
    if (
      extraction.minArea === undefined ||
      extraction.preferredArea !== undefined ||
      !this.hasApproximateAreaPreference(brief)
    ) {
      return extraction;
    }

    return {
      ...extraction,
      minArea: undefined,
      preferredArea: extraction.minArea,
    };
  }

  private mapAIExtractionToParsedBrief(
    extraction: AIRecommendationExtraction,
    brief?: string,
  ): RecommendationParsedBriefSource {
    const normalizedExtraction = this.normalizeAIAreaSemantics(brief, extraction);
    const detectedEntities: RecommendationDetectedEntityDto[] = [];
    const mapped: RecommendationParsedBriefSource = {
      mustHave: {},
      preferences: {},
      detectedEntities,
      detectedLocations: [],
      warnings: [],
      extractionSource: "ai",
      extractionConfidence: normalizedExtraction.confidence,
      aiExtraction: normalizedExtraction,
    };

    const categoryInput = this.normalizeString(normalizedExtraction.category);
    if (categoryInput && !isGenericCategoryCandidate(categoryInput)) {
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
      this.normalizeString(normalizedExtraction.location?.value) ||
      this.normalizeString(normalizedExtraction.landmarkPreference);
    const locationMode =
      normalizedExtraction.location?.mode || (locationValue ? "nearby" : undefined);

    if (locationValue && locationMode) {
      const detectedLocations = getLocationNamesFromPayload({
        location: locationValue,
      })
        .map((candidate) => buildLocationSearchProfile(candidate))
        .filter(
          (profile): profile is NonNullable<typeof profile> => profile !== undefined,
        )
        .map((profile) =>
          this.buildDetectedLocation(
            profile,
            profile.value,
            locationMode,
            normalizedExtraction.location?.confidence ??
              normalizedExtraction.confidence,
          ),
        );

      if (detectedLocations.length > 0) {
        mapped.detectedLocation = detectedLocations[0];
        mapped.detectedLocations = detectedLocations;
        mapped.locationMode = detectedLocations[0]?.mode;

        if (detectedLocations[0]?.mode === "strict") {
          mapped.mustHave.location = detectedLocations[0]?.value;
          mapped.mustHave.locations = detectedLocations.map(
            (location) => location.value,
          );
          mapped.preferences.location = detectedLocations[0]?.value;
          mapped.preferences.locations = detectedLocations.map(
            (location) => location.value,
          );
        } else {
          mapped.preferences.location = detectedLocations[0]?.value;
          mapped.preferences.locations = detectedLocations.map(
            (location) => location.value,
          );
        }

        detectedLocations.forEach((detectedLocation) => {
          this.pushDetectedEntity(detectedEntities, {
            type: "location",
            value: detectedLocation.value,
            raw: detectedLocation.raw,
          });
        });
      }
    }

    if (normalizedExtraction.maxPrice !== undefined) {
      mapped.mustHave.maxPrice = normalizedExtraction.maxPrice;
      this.pushDetectedEntity(detectedEntities, {
        type: "maxPrice",
        value: normalizedExtraction.maxPrice,
        raw: String(normalizedExtraction.maxPrice),
      });
    }

    if (normalizedExtraction.preferredPrice !== undefined) {
      mapped.preferences.price = normalizedExtraction.preferredPrice;
      this.pushDetectedEntity(detectedEntities, {
        type: "preferredPrice",
        value: normalizedExtraction.preferredPrice,
        raw: String(normalizedExtraction.preferredPrice),
      });
    }

    if (normalizedExtraction.minPrice !== undefined) {
      this.pushDetectedEntity(detectedEntities, {
        type: "minPrice",
        value: normalizedExtraction.minPrice,
        raw: String(normalizedExtraction.minPrice),
      });
    }

    if (normalizedExtraction.bedrooms !== undefined) {
      this.pushDetectedEntity(detectedEntities, {
        type: "bedrooms",
        value: normalizedExtraction.bedrooms,
        raw: String(normalizedExtraction.bedrooms),
      });
    }

    if (normalizedExtraction.bathrooms !== undefined) {
      this.pushDetectedEntity(detectedEntities, {
        type: "bathrooms",
        value: normalizedExtraction.bathrooms,
        raw: String(normalizedExtraction.bathrooms),
      });
    }

    if (normalizedExtraction.parking !== undefined) {
      this.pushDetectedEntity(detectedEntities, {
        type: "parking",
        value: normalizedExtraction.parking,
        raw: String(normalizedExtraction.parking),
      });
    }

    if (normalizedExtraction.furnished !== undefined) {
      this.pushDetectedEntity(detectedEntities, {
        type: "furnished",
        value: normalizedExtraction.furnished,
        raw: String(normalizedExtraction.furnished),
      });
    }

    if (normalizedExtraction.minArea !== undefined) {
      mapped.mustHave.minArea = normalizedExtraction.minArea;
      mapped.preferences.area =
        mapped.preferences.area ?? normalizedExtraction.minArea;
      this.pushDetectedEntity(detectedEntities, {
        type: "minArea",
        value: normalizedExtraction.minArea,
        raw: String(normalizedExtraction.minArea),
      });
    }

    if (normalizedExtraction.preferredArea !== undefined) {
      mapped.preferences.area = normalizedExtraction.preferredArea;
      this.pushDetectedEntity(detectedEntities, {
        type: "preferredArea",
        value: normalizedExtraction.preferredArea,
        raw: String(normalizedExtraction.preferredArea),
      });
    }

    if (normalizedExtraction.minRoi !== undefined) {
      mapped.mustHave.minRoi = normalizedExtraction.minRoi;
      mapped.preferences.roi =
        mapped.preferences.roi ?? normalizedExtraction.minRoi;
      this.pushDetectedEntity(detectedEntities, {
        type: "minRoi",
        value: normalizedExtraction.minRoi,
        raw: String(normalizedExtraction.minRoi),
      });
    }

    if (normalizedExtraction.preferredRoi !== undefined) {
      mapped.preferences.roi = normalizedExtraction.preferredRoi;
      this.pushDetectedEntity(detectedEntities, {
        type: "preferredRoi",
        value: normalizedExtraction.preferredRoi,
        raw: String(normalizedExtraction.preferredRoi),
      });
    }

    if (normalizedExtraction.maxDistanceFromHighway !== undefined) {
      mapped.mustHave.maxDistanceFromHighway =
        normalizedExtraction.maxDistanceFromHighway;
      mapped.preferences.maxDistanceFromHighway =
        normalizedExtraction.maxDistanceFromHighway;
      this.pushDetectedEntity(detectedEntities, {
        type: "maxDistanceFromHighway",
        value: normalizedExtraction.maxDistanceFromHighway,
        raw: String(normalizedExtraction.maxDistanceFromHighway),
      });
    }

    const landmark = this.normalizeString(normalizedExtraction.landmarkPreference);
    if (landmark) {
      this.pushDetectedEntity(detectedEntities, {
        type: "landmark",
        value: landmark,
        raw: landmark,
      });
    }

    const normalizedStatus = normalizedExtraction.status
      ? normalizePropertyStatus(normalizedExtraction.status)
      : undefined;
    if (normalizedStatus) {
      mapped.mustHave.status = normalizedStatus;
      this.pushDetectedEntity(detectedEntities, {
        type: "status",
        value: normalizedStatus,
        raw: normalizedExtraction.status!,
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

    return this.mapAIExtractionToParsedBrief(aiResult.extraction, normalizedBrief);
  }

  private mergeParsedBriefSources(
    deterministicParsedBrief: RecommendationParsedBriefSource,
    aiParsedBrief: RecommendationParsedBriefSource | null,
  ): RecommendationParsedBriefSource {
    if (!aiParsedBrief) {
      return deterministicParsedBrief;
    }

    const detectedEntities: RecommendationDetectedEntityDto[] = [];
    const pushMergedEntity = (entity: RecommendationDetectedEntityDto) => {
      const exists = detectedEntities.some(
        (current) =>
          current.type === entity.type && current.value === entity.value,
      );

      if (!exists) {
        detectedEntities.push(entity);
      }
    };

    aiParsedBrief.detectedEntities.forEach(pushMergedEntity);
    deterministicParsedBrief.detectedEntities.forEach(pushMergedEntity);

    const detectedLocations: RecommendationDetectedLocationDto[] = [];
    const pushMergedLocation = (location: RecommendationDetectedLocationDto) => {
      const exists = detectedLocations.some(
        (current) =>
          current.normalizedValue === location.normalizedValue &&
          current.mode === location.mode,
      );

      if (!exists) {
        detectedLocations.push(location);
      }
    };

    aiParsedBrief.detectedLocations.forEach(pushMergedLocation);
    deterministicParsedBrief.detectedLocations.forEach(pushMergedLocation);

    const warnings = [
      ...new Set([
        ...deterministicParsedBrief.warnings,
        ...aiParsedBrief.warnings,
      ]),
    ];

    return {
      ...deterministicParsedBrief,
      ...aiParsedBrief,
      mustHave: {
        ...deterministicParsedBrief.mustHave,
        ...aiParsedBrief.mustHave,
      },
      preferences: {
        ...deterministicParsedBrief.preferences,
        ...aiParsedBrief.preferences,
      },
      detectedEntities,
      detectedLocation:
        aiParsedBrief.detectedLocation ??
        deterministicParsedBrief.detectedLocation,
      detectedLocations,
      warnings,
    };
  }

  async parse(
    input: RecommendationRequestDto,
  ): Promise<ParsedRecommendationQueryResult> {
    const brief = this.normalizeString(input.brief);
    const deterministicParsedBrief = parseRecommendationBrief(brief);
    const aiParsedBrief = await this.parseBriefWithAI(brief);
    const parsedBrief = this.mergeParsedBriefSources(
      deterministicParsedBrief,
      aiParsedBrief,
    );
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
