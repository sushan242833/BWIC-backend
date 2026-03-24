import express from "express";
import PropertyController from "@controller/properties.controller";
import { upload } from "@config/multer";
import { requireAdmin } from "../middleware/auth.middleware";
import { validateRequest } from "../validation/request-validation";
import {
  createPropertySchema,
  idParamSchema,
  propertyListQuerySchema,
  updatePropertySchema,
} from "../validation/request-schemas";
import {
  PROPERTY_IMAGE_FIELD_NAME,
  PROPERTY_IMAGE_UPLOAD_LIMIT,
} from "@utils/property-images";

const router = express.Router();

router.get(
  "/",
  validateRequest({ query: propertyListQuerySchema }),
  (req, res, next) => PropertyController.getAll(req, res, next),
);
router.get(
  "/:id",
  validateRequest({ params: idParamSchema }),
  (req, res, next) => PropertyController.getById(req, res, next),
);
router.delete(
  "/:id",
  requireAdmin,
  validateRequest({ params: idParamSchema }),
  (req, res, next) => PropertyController.delete(req, res, next),
);
router.post(
  "/",
  requireAdmin,
  upload.array(PROPERTY_IMAGE_FIELD_NAME, PROPERTY_IMAGE_UPLOAD_LIMIT),
  validateRequest({ body: createPropertySchema }),
  (req, res, next) => PropertyController.create(req, res, next),
);
router.put(
  "/:id",
  requireAdmin,
  upload.array(PROPERTY_IMAGE_FIELD_NAME, PROPERTY_IMAGE_UPLOAD_LIMIT),
  validateRequest({ params: idParamSchema, body: updatePropertySchema }),
  (req, res, next) => PropertyController.update(req, res, next),
);

export { router as propertiesRouter };
