// src/controllers/category.controller.ts

import { NextFunction, Request, Response } from "express";
import { Category } from "@models/category.model";
import { Property } from "@models/properties.model";
import { CreateCategoryDto, UpdateCategoryDto } from "@dto/category.dto";
import { AppError } from "../middleware/error.middleware";

export class CategoryController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await Category.findAll({
        include: [{ model: Property }],
      });
      res.status(200).json(categories);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const category = await Category.findByPk(id, {
        include: [{ model: Property }],
      });

      if (!category) {
        return next(new AppError("Category not found", 404));
      }

      res.status(200).json(category);
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

      res.status(201).json(category);
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
      res.status(200).json(category);
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

      await category.destroy();
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export default new CategoryController();
