import { Router } from "express";
import CategoryController from "@controller/category.controller";
import { requireAdminAuth } from "../middleware/admin-auth.middleware";

const router = Router();

// GET /api/categories - Get all categories
router.get("/", CategoryController.getAll);

// GET /api/categories/:id - Get category by ID
router.get("/:id", CategoryController.getById);

// POST /api/categories - Create a new category
router.post("/", requireAdminAuth, CategoryController.create);

// PUT /api/categories/:id - Update category by ID
router.put("/:id", requireAdminAuth, CategoryController.update);

// DELETE /api/categories/:id - Delete category by ID
router.delete("/:id", requireAdminAuth, CategoryController.delete);

export { router as categoriesRouter };
