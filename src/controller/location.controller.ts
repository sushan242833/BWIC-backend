import { Request, Response } from "express";
import { autocompleteLocations } from "@utils/geocoding";

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
      if (!process.env.GOOGLE_MAPS_API_KEY) {
        return res.status(500).json({
          message: "GOOGLE_MAPS_API_KEY is not configured on the backend",
          data: [],
        });
      }

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
}

export default new LocationController();
