import { Router } from "express";
import {
  createAdminToken,
  isValidAdminCredentials,
  verifyAdminToken,
} from "@utils/admin-auth";

const router = Router();

router.post("/admin/login", (req, res) => {
  const { id, password } = req.body as { id?: string; password?: string };

  if (!id || !password) {
    return res.status(400).json({ message: "ID and password are required" });
  }

  if (!isValidAdminCredentials(id, password)) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = createAdminToken(id);

  return res.status(200).json({
    message: "Login successful",
    token,
  });
});

router.get("/admin/verify", (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.slice(7);
  const payload = verifyAdminToken(token);

  if (!payload) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return res.status(200).json({ authenticated: true });
});

export { router as authRouter };
