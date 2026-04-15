import { NextFunction, Request, Response } from "express";
import type { RecommendationRequestDto } from "@dto/recommendation.dto";
import recommendationService from "@services/recommendation.service";
import { sendSuccess } from "@utils/api-response";

export class RecommendationController {
  async getRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const source =
        req.method === "GET"
          ? recommendationService.buildRequestFromQuery(
              req.query as Record<string, unknown>,
            )
          : (req.body as RecommendationRequestDto);

      const result = await recommendationService.getRecommendations(source, {
        userId: req.user?.id,
      });

      return sendSuccess(res, {
        message: "Top recommendations fetched successfully",
        data: result.data,
        pagination: result.pagination,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new RecommendationController();
