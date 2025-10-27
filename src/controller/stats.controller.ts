import { Request, Response } from "express";
import { Property } from "@models/properties.model";
import { Category } from "@models/category.model";

export class StatsController {
  async getStats(req: Request, res: Response) {
    try {
      const totalProperties = await Property.count();
      const totalCategories = await Category.count();

      res.status(200).json({
        totalProperties,
        totalCategories,
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      res.status(500).json({ message: "Failed to fetch stats", error });
    }
  }
}

export default new StatsController();
