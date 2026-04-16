import { NextFunction, Request, Response } from "express";
import type { RecommendationRequestDto } from "@dto/recommendation.dto";
import recommendationService from "@services/recommendation.service";
import { sendSuccess } from "@utils/api-response";

export class RecommendationController {
  private resolveSource(req: Request): RecommendationRequestDto {
    return req.method === "GET"
      ? recommendationService.buildRequestFromQuery(
          req.query as Record<string, unknown>,
        )
      : (req.body as RecommendationRequestDto);
  }

  async getRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const source = this.resolveSource(req);

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

  async getRecommendationDetail(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const propertyId = Number(req.params.propertyId);
      const source = this.resolveSource(req);

      const result = await recommendationService.getRecommendationDetail(
        propertyId,
        source,
        {
          userId: req.user?.id,
        },
      );

      return sendSuccess(res, {
        message: "Recommendation detail fetched successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new RecommendationController();
