import { Router } from "express";
import UserRecommendationSettingsController from "@controller/user-recommendation-settings.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireTrustedOrigin } from "../middleware/csrf.middleware";
import { validateRequest } from "../validation/request-validation";
import { recommendationSettingsUpdateSchema } from "../validation/request-schemas";

const router = Router();

router.get(
  "/recommendation-settings",
  requireAuth,
  (req, res, next) =>
    UserRecommendationSettingsController.getSettings(req, res, next),
);

router.put(
  "/recommendation-settings",
  requireTrustedOrigin,
  requireAuth,
  validateRequest({ body: recommendationSettingsUpdateSchema }),
  (req, res, next) =>
    UserRecommendationSettingsController.updateSettings(req, res, next),
);

router.patch(
  "/recommendation-settings",
  requireTrustedOrigin,
  requireAuth,
  validateRequest({ body: recommendationSettingsUpdateSchema }),
  (req, res, next) =>
    UserRecommendationSettingsController.updateSettings(req, res, next),
);

router.delete(
  "/recommendation-settings",
  requireTrustedOrigin,
  requireAuth,
  (req, res, next) =>
    UserRecommendationSettingsController.resetSettings(req, res, next),
);

export { router as userRouter };
