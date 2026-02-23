import { NextFunction, Request, Response } from "express";
import { verifyAdminToken } from "@utils/admin-auth";

export function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.slice(7);
  const payload = verifyAdminToken(token);

  if (!payload) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return next();
}
