import express from "express";
import ContactController from "@controller/contact.controller";
import { requireAdmin } from "../middleware/auth.middleware";
import { validateRequest } from "../validation/request-validation";
import {
  createContactSchema,
  idParamSchema,
} from "../validation/request-schemas";

const router = express.Router();

router.get("/", requireAdmin, ContactController.getAll);
router.get(
  "/:id",
  requireAdmin,
  validateRequest({ params: idParamSchema }),
  ContactController.getById,
);
router.post(
  "/",
  validateRequest({ body: createContactSchema }),
  ContactController.submitContactMessage,
);

export { router as contactRouter };
