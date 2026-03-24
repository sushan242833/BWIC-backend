import { Router } from "express";
import StatsController from "@controller/stats.controller";
import { requireAdmin } from "../middleware/auth.middleware";

const router = Router();

/**
 * GET /api/stats
 * Returns total number of properties and categories
 */
router.get("/", requireAdmin, StatsController.getStats);

export { router as statsRouter };
