import { NextFunction, Request, Response } from "express";
import favoriteService from "@services/favorite.service";
import { sendSuccess } from "@utils/api-response";
import { AppError } from "../middleware/error.middleware";

export const getAuthenticatedUserId = (req: Request): number => {
  if (!req.user?.id) {
    throw new AppError("Authentication required", 401);
  }

  return req.user.id;
};

const getPropertyId = (req: Request): number => Number(req.params.propertyId);

export class FavoriteController {
  async addFavorite(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await favoriteService.addFavorite(
        getAuthenticatedUserId(req),
        getPropertyId(req),
      );

      return sendSuccess(res, {
        statusCode: 201,
        message: "Property added to favorites",
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async removeFavorite(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await favoriteService.removeFavorite(
        getAuthenticatedUserId(req),
        getPropertyId(req),
      );

      return sendSuccess(res, {
        message: "Property removed from favorites",
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async listFavorites(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await favoriteService.listFavorites(
        getAuthenticatedUserId(req),
      );

      return sendSuccess(res, {
        message: "Favorites fetched successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async checkFavorite(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await favoriteService.checkFavorite(
        getAuthenticatedUserId(req),
        getPropertyId(req),
      );

      return sendSuccess(res, {
        message: "Favorite status fetched successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new FavoriteController();
