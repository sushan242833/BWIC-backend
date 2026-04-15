import {
  DEFAULT_RECOMMENDATION_WEIGHTS,
  RECOMMENDATION_WEIGHT_KEYS,
  RECOMMENDATION_WEIGHT_TOTAL,
  RecommendationWeights,
} from "@constants/recommendation-weights";
import type {
  RecommendationSettingsResponseDto,
  RecommendationSettingsUpdateResponseDto,
  ResolvedRecommendationWeightsDto,
  UpdateRecommendationSettingsRequestDto,
} from "@dto/recommendation-settings.dto";
import { UserRecommendationSettings } from "@models/user-recommendation-settings.model";
import { AppError } from "../middleware/error.middleware";

const round2 = (value: number) => Math.round(value * 100) / 100;

const getRecommendationWeightTotal = (weights: RecommendationWeights) =>
  round2(
    RECOMMENDATION_WEIGHT_KEYS.reduce((sum, key) => sum + weights[key], 0),
  );

export const assertValidRecommendationWeights = (
  weights: RecommendationWeights,
): void => {
  for (const key of RECOMMENDATION_WEIGHT_KEYS) {
    const value = weights[key];

    if (!Number.isFinite(value)) {
      throw new AppError(`${key} weight must be a finite number`, 400);
    }

    if (value < 0) {
      throw new AppError(`${key} weight cannot be negative`, 400);
    }
  }

  const total = getRecommendationWeightTotal(weights);

  if (total <= 0) {
    throw new AppError("At least one recommendation weight must be greater than 0", 400);
  }
};

const assertRecommendationWeightTotal = (
  weights: RecommendationWeights,
): void => {
  const total = getRecommendationWeightTotal(weights);

  if (total !== RECOMMENDATION_WEIGHT_TOTAL) {
    throw new AppError(
      `Recommendation weights must total ${RECOMMENDATION_WEIGHT_TOTAL}`,
      400,
    );
  }
};

export const normalizeRecommendationWeights = (
  weights: RecommendationWeights,
): RecommendationWeights => {
  assertValidRecommendationWeights(weights);

  const total = getRecommendationWeightTotal(weights);

  const normalizedEntries = RECOMMENDATION_WEIGHT_KEYS.map((key) => [
    key,
    round2((weights[key] / total) * RECOMMENDATION_WEIGHT_TOTAL),
  ]) as Array<[keyof RecommendationWeights, number]>;

  const allButLastTotal = normalizedEntries
    .slice(0, -1)
    .reduce((sum, [, value]) => sum + value, 0);
  normalizedEntries[normalizedEntries.length - 1][1] = round2(
    RECOMMENDATION_WEIGHT_TOTAL - allButLastTotal,
  );

  return Object.fromEntries(normalizedEntries) as RecommendationWeights;
};

export const resolveRecommendationWeights = ({
  defaults = DEFAULT_RECOMMENDATION_WEIGHTS,
  userSettings,
}: {
  defaults?: RecommendationWeights;
  userSettings?: RecommendationWeights | null;
}): ResolvedRecommendationWeightsDto => {
  const hasUserSettings = Boolean(userSettings);

  return {
    weights: normalizeRecommendationWeights(userSettings ?? defaults),
    isDefault: !hasUserSettings,
    source: hasUserSettings ? "user" : "default",
  };
};

const serializeSettingsModel = (
  settings: UserRecommendationSettings,
): RecommendationWeights => ({
  location: Number(settings.locationWeight),
  price: Number(settings.priceWeight),
  area: Number(settings.areaWeight),
  roi: Number(settings.roiWeight),
  highwayAccess: Number(settings.highwayAccessWeight),
});

const toPersistencePayload = (
  userId: number,
  weights: RecommendationWeights,
) => ({
  userId,
  locationWeight: weights.location,
  priceWeight: weights.price,
  areaWeight: weights.area,
  roiWeight: weights.roi,
  highwayAccessWeight: weights.highwayAccess,
});

export class RecommendationWeightService {
  /**
   * User-entered weights must total 100 before saving. Resolution still
   * normalizes defensively so older rows or direct DB edits cannot break the
   * recommendation scorer.
   */
  async getSettingsForUser(
    userId: number,
  ): Promise<RecommendationSettingsResponseDto> {
    const settings = await UserRecommendationSettings.findByPk(userId);

    if (!settings) {
      return {
        weights: { ...DEFAULT_RECOMMENDATION_WEIGHTS },
        isDefault: true,
      };
    }

    return {
      weights: serializeSettingsModel(settings),
      isDefault: false,
    };
  }

  async upsertSettingsForUser(
    userId: number,
    weights: UpdateRecommendationSettingsRequestDto,
  ): Promise<RecommendationSettingsUpdateResponseDto> {
    assertValidRecommendationWeights(weights);
    assertRecommendationWeightTotal(weights);

    const existing = await UserRecommendationSettings.findByPk(userId);
    const payload = toPersistencePayload(userId, weights);

    if (existing) {
      await existing.update(payload);
    } else {
      await UserRecommendationSettings.create(payload);
    }

    return { weights };
  }

  async resetSettingsForUser(
    userId: number,
  ): Promise<RecommendationSettingsResponseDto> {
    await UserRecommendationSettings.destroy({ where: { userId } });

    return {
      weights: { ...DEFAULT_RECOMMENDATION_WEIGHTS },
      isDefault: true,
    };
  }

  async resolveForUser(
    userId?: number,
  ): Promise<ResolvedRecommendationWeightsDto> {
    if (!userId) {
      return resolveRecommendationWeights({});
    }

    const settings = await UserRecommendationSettings.findByPk(userId);

    return resolveRecommendationWeights({
      userSettings: settings ? serializeSettingsModel(settings) : null,
    });
  }
}

export default new RecommendationWeightService();
