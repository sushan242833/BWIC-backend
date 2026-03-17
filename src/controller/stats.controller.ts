import { NextFunction, Request, Response } from "express";
import { Property } from "@models/properties.model";
import { Category } from "@models/category.model";

export class StatsController {
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const totalProperties = await Property.count();
      const totalCategories = await Category.count();

      res.status(200).json({
        totalProperties,
        totalCategories,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new StatsController();
