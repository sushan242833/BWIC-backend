import { Router } from "express";
import LocationController from "@controller/location.controller";
import { validateRequest } from "../validation/request-validation";
import {
  autocompleteQuerySchema,
  placeDetailsQuerySchema,
} from "../validation/request-schemas";

const router = Router();

router.get(
  "/autocomplete",
  validateRequest({ query: autocompleteQuerySchema }),
  (req, res, next) => LocationController.autocomplete(req, res, next),
);
router.get(
  "/place-details",
  validateRequest({ query: placeDetailsQuerySchema }),
  (req, res, next) => LocationController.placeDetails(req, res, next),
);

export { router as locationRouter };
