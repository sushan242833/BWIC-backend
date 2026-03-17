import { Router } from "express";
import RecommendationController from "@controller/recommendation.controller";
import { validateRequest } from "../validation/request-validation";
import {
  recommendationBodySchema,
  recommendationQuerySchema,
} from "../validation/request-schemas";

const router = Router();

router.get(
  "/",
  validateRequest({ query: recommendationQuerySchema }),
  (req, res, next) => RecommendationController.getRecommendations(req, res, next),
);
router.post(
  "/",
  validateRequest({ body: recommendationBodySchema }),
  (req, res, next) => RecommendationController.getRecommendations(req, res, next),
);

export { router as recommendationRouter };
