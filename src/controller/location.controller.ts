import { Request, Response } from "express";
import { autocompleteLocations, getPlaceDetails } from "@utils/geocoding";

export class LocationController {
  private extractQueryString(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      const first = value[0];
      return typeof first === "string" ? first : undefined;
    }
    return undefined;
  }

  async autocomplete(req: Request, res: Response) {
    try {
      const query = this.extractQueryString(req.query.q)?.trim() || "";

      if (query.length < 2) {
        return res.status(200).json({ data: [] });
      }

      const suggestions = await autocompleteLocations(query);
      return res.status(200).json({ data: suggestions });
    } catch (error) {
      console.error("Failed to autocomplete locations:", error);
      return res.status(500).json({
        message: "Failed to autocomplete locations",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async placeDetails(req: Request, res: Response) {
    try {
      const placeId = this.extractQueryString(req.query.placeId)?.trim() || "";
      if (!placeId) {
        return res.status(400).json({
          success: false,
          message: "placeId query parameter is required",
          data: null,
        });
      }

      const details = await getPlaceDetails(placeId);
      if (!details) {
        return res.status(404).json({
          success: false,
          message: "Place details not found",
          data: null,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Place details fetched successfully",
        data: details,
      });
    } catch (error) {
      console.error("Failed to fetch place details:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch place details",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export default new LocationController();
