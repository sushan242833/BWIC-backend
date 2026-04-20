import { Router } from "express";
import FavoriteController from "@controller/favorite.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validateRequest } from "../validation/request-validation";
import { favoritePropertyParamSchema } from "../validation/request-schemas";

const router = Router();

router.get("/", requireAuth, (req, res, next) =>
  FavoriteController.listFavorites(req, res, next),
);

router.get(
  "/check/:propertyId",
  requireAuth,
  validateRequest({ params: favoritePropertyParamSchema }),
  (req, res, next) => FavoriteController.checkFavorite(req, res, next),
);

router.post(
  "/:propertyId",
  requireAuth,
  validateRequest({ params: favoritePropertyParamSchema }),
  (req, res, next) => FavoriteController.addFavorite(req, res, next),
);

router.delete(
  "/:propertyId",
  requireAuth,
  validateRequest({ params: favoritePropertyParamSchema }),
  (req, res, next) => FavoriteController.removeFavorite(req, res, next),
);

export { router as favoriteRouter };
