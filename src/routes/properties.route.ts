import express from "express";
import PropertyController from "@controller/properties.controller";
import { upload } from "@config/multer";
import { validateRequest } from "../validation/request-validation";
import {
  createPropertySchema,
  idParamSchema,
  propertyListQuerySchema,
  updatePropertySchema,
} from "../validation/request-schemas";

const router = express.Router();

router.get("/", validateRequest({ query: propertyListQuerySchema }), (req, res) =>
  PropertyController.getAll(req, res),
);
router.get("/:id", validateRequest({ params: idParamSchema }), (req, res) =>
  PropertyController.getById(req, res),
);
router.delete("/:id", validateRequest({ params: idParamSchema }), (req, res) =>
  PropertyController.delete(req, res),
);
router.post("/", upload.array("images", 10), validateRequest({ body: createPropertySchema }), (req, res) =>
  PropertyController.create(req, res),
);
router.put(
  "/:id",
  upload.array("images", 10),
  validateRequest({ params: idParamSchema, body: updatePropertySchema }),
  (req, res) =>
  PropertyController.update(req, res),
);

export { router as propertiesRouter };
