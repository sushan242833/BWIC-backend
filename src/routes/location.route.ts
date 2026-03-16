import { Router } from "express";
import LocationController from "@controller/location.controller";
import { validateRequest } from "../validation/request-validation";
import {
  autocompleteQuerySchema,
  placeDetailsQuerySchema,
} from "../validation/request-schemas";

const router = Router();

router.get("/autocomplete", validateRequest({ query: autocompleteQuerySchema }), (req, res) =>
  LocationController.autocomplete(req, res),
);
router.get("/place-details", validateRequest({ query: placeDetailsQuerySchema }), (req, res) =>
  LocationController.placeDetails(req, res),
);

export { router as locationRouter };
