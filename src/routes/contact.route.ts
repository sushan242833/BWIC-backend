import express from "express";
import ContactController from "@controller/contact.controller";
import { validateRequest } from "../validation/request-validation";
import {
  createContactSchema,
  idParamSchema,
} from "../validation/request-schemas";

const router = express.Router();

router.get("/", ContactController.getAll);
router.get("/:id", validateRequest({ params: idParamSchema }), ContactController.getById);
router.post(
  "/",
  validateRequest({ body: createContactSchema }),
  ContactController.submitContactMessage,
);

export { router as contactRouter };
