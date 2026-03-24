import { Router } from "express";
import AuthController from "@controller/auth.controller";
import { optionalAuth } from "../middleware/auth.middleware";
import { validateRequest } from "../validation/request-validation";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  validateResetTokenQuerySchema,
} from "../validation/request-schemas";

const router = Router();

router.post(
  "/register",
  validateRequest({ body: registerSchema }),
  (req, res, next) => AuthController.register(req, res, next),
);

router.post("/login", validateRequest({ body: loginSchema }), (req, res, next) =>
  AuthController.login(req, res, next),
);

router.post(
  "/forgot-password",
  validateRequest({ body: forgotPasswordSchema }),
  (req, res, next) => AuthController.forgotPassword(req, res, next),
);

router.get(
  "/validate-reset-token",
  validateRequest({ query: validateResetTokenQuerySchema }),
  (req, res, next) => AuthController.validateResetToken(req, res, next),
);

router.post(
  "/reset-password",
  validateRequest({ body: resetPasswordSchema }),
  (req, res, next) => AuthController.resetPassword(req, res, next),
);

router.post("/logout", (req, res, next) => AuthController.logout(req, res, next));

router.get("/me", optionalAuth, (req, res, next) =>
  AuthController.me(req, res, next),
);

export { router as authRouter };
