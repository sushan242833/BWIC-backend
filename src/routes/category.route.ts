import { Router } from "express";
import CategoryController from "@controller/category.controller";
import { validateRequest } from "../validation/request-validation";
import {
  createCategorySchema,
  idParamSchema,
  updateCategorySchema,
} from "../validation/request-schemas";

const router = Router();

// GET /api/categories - Get all categories
router.get("/", CategoryController.getAll);

// GET /api/categories/:id - Get category by ID
router.get("/:id", validateRequest({ params: idParamSchema }), CategoryController.getById);

// POST /api/categories - Create a new category
router.post("/", validateRequest({ body: createCategorySchema }), CategoryController.create);

// PUT /api/categories/:id - Update category by ID
router.put(
  "/:id",
  validateRequest({ params: idParamSchema, body: updateCategorySchema }),
  CategoryController.update,
);

// DELETE /api/categories/:id - Delete category by ID
router.delete("/:id", validateRequest({ params: idParamSchema }), CategoryController.delete);

export { router as categoriesRouter };
