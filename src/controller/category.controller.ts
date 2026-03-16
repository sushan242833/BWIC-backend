// src/controllers/category.controller.ts

import { Request, Response } from "express";
import { Category } from "@models/category.model";
import { Property } from "@models/properties.model";
import { CreateCategoryDto, UpdateCategoryDto } from "@dto/category.dto";

export class CategoryController {
  async getAll(req: Request, res: Response) {
    try {
      const categories = await Category.findAll({
        include: [{ model: Property }],
      });
      res.status(200).json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories", error });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const category = await Category.findByPk(id, {
        include: [{ model: Property }],
      });

      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.status(200).json(category);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch category", error });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { name } = req.body as CreateCategoryDto;

      const existing = await Category.findOne({ where: { name } });
      if (existing) {
        return res
          .status(400)
          .json({ message: "Category with this name already exists" });
      }

      const category = await Category.create({ name });

      await category.save();

      res.status(201).json(category);
    } catch (error) {
      res.status(400).json({ message: "Failed to create category", error });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const { name } = req.body as UpdateCategoryDto;

      const category = await Category.findByPk(id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      await category.update({ name });
      res.status(200).json(category);
    } catch (error) {
      res.status(400).json({ message: "Failed to update category", error });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const category = await Category.findByPk(id);

      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      await category.destroy();
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ message: "Failed to delete category", error });
    }
  }
}

export default new CategoryController();
