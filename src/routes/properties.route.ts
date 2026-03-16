import express from "express";
import PropertyController from "@controller/properties.controller";
import { upload } from "@config/multer";

const router = express.Router();

router.get("/", (req, res) => PropertyController.getAll(req, res));
router.get("/:id", (req, res) => PropertyController.getById(req, res));
router.delete("/:id", (req, res) => PropertyController.delete(req, res));
router.post("/", upload.array("images", 10), (req, res) =>
  PropertyController.create(req, res),
);
router.put("/:id", upload.array("images", 10), (req, res) =>
  PropertyController.update(req, res),
);

export { router as propertiesRouter };
