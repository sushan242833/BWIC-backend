import { Router } from "express";
import RecommendationController from "@controller/recommendation.controller";
import { optionalAuth } from "../middleware/auth.middleware";
import { validateRequest } from "../validation/request-validation";
import {
  recommendationDetailParamSchema,
  recommendationBodySchema,
  recommendationQuerySchema,
} from "../validation/request-schemas";

const router = Router();

router.get(
  "/:propertyId/details",
  optionalAuth,
  validateRequest({
    params: recommendationDetailParamSchema,
    query: recommendationQuerySchema,
  }),
  (req, res, next) =>
    RecommendationController.getRecommendationDetail(req, res, next),
);
router.get(
  "/",
  optionalAuth,
  validateRequest({ query: recommendationQuerySchema }),
  (req, res, next) =>
    RecommendationController.getRecommendations(req, res, next),
);
router.post(
  "/",
  optionalAuth,
  validateRequest({ body: recommendationBodySchema }),
  (req, res, next) =>
    RecommendationController.getRecommendations(req, res, next),
);

export { router as recommendationRouter };
