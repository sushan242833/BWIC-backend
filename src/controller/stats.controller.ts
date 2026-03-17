import { NextFunction, Request, Response } from "express";
import { Property } from "@models/properties.model";
import { Category } from "@models/category.model";
import { sendSuccess } from "@utils/api-response";

export class StatsController {
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const totalProperties = await Property.count();
      const totalCategories = await Category.count();

      return sendSuccess(res, {
        message: "Stats fetched successfully",
        data: {
          totalProperties,
          totalCategories,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new StatsController();
