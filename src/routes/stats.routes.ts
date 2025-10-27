import { Router } from "express";
import StatsController from "@controller/stats.controller";

const router = Router();

/**
 * GET /api/stats
 * Returns total number of properties and categories
 */
router.get("/", StatsController.getStats);

export { router as statsRouter };
