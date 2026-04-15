import { NextFunction, Request, Response } from "express";
import type { UpdateRecommendationSettingsRequestDto } from "@dto/recommendation-settings.dto";
import recommendationWeightService from "@services/recommendation-weight.service";
import { sendSuccess } from "@utils/api-response";
import { AppError } from "../middleware/error.middleware";

const getAuthenticatedUserId = (req: Request): number => {
  if (!req.user?.id) {
    throw new AppError("Authentication required", 401);
  }

  return req.user.id;
};

export class UserRecommendationSettingsController {
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await recommendationWeightService.getSettingsForUser(
        getAuthenticatedUserId(req),
      );

      return sendSuccess(res, {
        message: "Recommendation settings fetched successfully",
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await recommendationWeightService.upsertSettingsForUser(
        getAuthenticatedUserId(req),
        req.body as UpdateRecommendationSettingsRequestDto,
      );

      return sendSuccess(res, {
        message: "Recommendation settings updated successfully",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async resetSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await recommendationWeightService.resetSettingsForUser(
        getAuthenticatedUserId(req),
      );

      return sendSuccess(res, {
        message: "Recommendation settings reset to defaults successfully",
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserRecommendationSettingsController();
