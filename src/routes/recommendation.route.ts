import { Router } from "express";
import RecommendationController from "@controller/recommendation.controller";

const router = Router();

router.get("/", (req, res) => RecommendationController.getRecommendations(req, res));
router.post("/", (req, res) =>
  RecommendationController.getRecommendations(req, res),
);

export { router as recommendationRouter };
