import { Router } from "express";
import LocationController from "@controller/location.controller";

const router = Router();

router.get("/autocomplete", (req, res) =>
  LocationController.autocomplete(req, res),
);
router.get("/place-details", (req, res) =>
  LocationController.placeDetails(req, res),
);

export { router as locationRouter };
