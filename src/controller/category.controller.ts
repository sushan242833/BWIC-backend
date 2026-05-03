// src/controllers/category.controller.ts

import { NextFunction, Request, Response } from "express";
import { col, fn } from "sequelize";
import { Category } from "@models/category.model";
import { Property } from "@models/properties.model";
import { CreateCategoryDto, UpdateCategoryDto } from "@dto/category.dto";
import { AppError } from "../middleware/error.middleware";
import { sendSuccess } from "@utils/api-response";
import {
  serializeCategoryDetail,
  serializeCategorySummary,
} from "@utils/category-serializers";

export class CategoryController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await Category.findAll({
        attributes: [
          "id",
          "name",
          [fn("COUNT", col("properties.id")), "propertyCount"],
        ],
        include: [
          {
            model: Property,
            attributes: [],
          },
        ],
        group: ["Category.id", "Category.name"],
        order: [["id", "ASC"]],
      });
      return sendSuccess(res, {
        message: "Categories fetched successfully",
        data: categories.map((category) =>
          serializeCategorySummary({
            id: Number(category.get("id")),
            name: String(category.get("name")),
            propertyCount: category.get("propertyCount") as number | string,
          }),
        ),
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const category = await Category.findByPk(id);

      if (!category) {
        return next(new AppError("Category not found", 404));
      }

      const propertyCount = await Property.count({
        where: { categoryId: Number(id) },
      });

      return sendSuccess(res, {
        message: "Category fetched successfully",
        data: serializeCategoryDetail(category, propertyCount),
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name } = req.body as CreateCategoryDto;

      const existing = await Category.findOne({ where: { name } });
      if (existing) {
        return next(
          new AppError("Category with this name already exists", 400),
        );
      }

      const category = await Category.create({ name });

      await category.save();

      return sendSuccess(res, {
        statusCode: 201,
        message: "Category created successfully",
        data: serializeCategoryDetail(category, 0),
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const { name } = req.body as UpdateCategoryDto;

      const category = await Category.findByPk(id);
      if (!category) {
        return next(new AppError("Category not found", 404));
      }

      await category.update({ name });
      const propertyCount = await Property.count({
        where: { categoryId: Number(id) },
      });
      return sendSuccess(res, {
        message: "Category updated successfully",
        data: serializeCategoryDetail(category, propertyCount),
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const category = await Category.findByPk(id);

      if (!category) {
        return next(new AppError("Category not found", 404));
      }

      const propertyCount = await Property.count({
        where: { categoryId: Number(id) },
      });

      if (propertyCount > 0) {
        return next(
          new AppError(
            "This category cannot be deleted while properties are still assigned to it.",
            409,
          ),
        );
      }

      await category.destroy();
      return sendSuccess(res, {
        message: "Category deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new CategoryController();
