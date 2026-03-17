import { NextFunction, Request, Response } from "express";
import { autocompleteLocations, getPlaceDetails } from "@utils/geocoding";
import { AppError } from "../middleware/error.middleware";

export class LocationController {
  private extractQueryString(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      const first = value[0];
      return typeof first === "string" ? first : undefined;
    }
    return undefined;
  }

  async autocomplete(req: Request, res: Response, next: NextFunction) {
    try {
      const query = this.extractQueryString(req.query.q)?.trim() || "";

      if (query.length < 2) {
        return res.status(200).json({ data: [] });
      }

      const suggestions = await autocompleteLocations(query);
      return res.status(200).json({ data: suggestions });
    } catch (error) {
      next(error);
    }
  }

  async placeDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const placeId = this.extractQueryString(req.query.placeId)?.trim() || "";
      if (!placeId) {
        return next(new AppError("placeId query parameter is required", 400));
      }

      const details = await getPlaceDetails(placeId);
      if (!details) {
        return next(new AppError("Place details not found", 404));
      }

      return res.status(200).json({
        success: true,
        message: "Place details fetched successfully",
        data: details,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new LocationController();
