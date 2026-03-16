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
  (req, res) => RecommendationController.getRecommendations(req, res),
);
router.post(
  "/",
  validateRequest({ body: recommendationBodySchema }),
  (req, res) => RecommendationController.getRecommendations(req, res),
);

export { router as recommendationRouter };
