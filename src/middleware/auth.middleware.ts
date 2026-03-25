import { NextFunction, Request, Response } from "express";
import { USER_ROLE, User } from "@models/user.model";
import { serializeAuthUser } from "@utils/auth-user";
import {
  authCookieName,
  clearAuthCookie,
  verifyAuthToken,
} from "@utils/token";
import { AppError } from "./error.middleware";

const authErrorMessage = "Authentication required";

const attachAuthenticatedUser = async (
  req: Request,
  res: Response,
  strict: boolean,
): Promise<void> => {
  const token = req.cookies?.[authCookieName];

  if (!token) {
    if (strict) {
      throw new AppError(authErrorMessage, 401);
    }
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    const user = await User.findByPk(Number(payload.sub));

    if (!user) {
      clearAuthCookie(res);
      if (strict) {
        throw new AppError(authErrorMessage, 401);
      }
      return;
    }

    if (!user.isActive) {
      clearAuthCookie(res);
      if (strict) {
        throw new AppError("Your account is inactive", 403);
      }
      return;
    }

    req.user = serializeAuthUser(user);
  } catch (error) {
    clearAuthCookie(res);

    if (strict) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(authErrorMessage, 401);
    }
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await attachAuthenticatedUser(req, res, false);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await attachAuthenticatedUser(req, res, true);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await attachAuthenticatedUser(req, res, true);

    if (!req.user || req.user.role !== USER_ROLE.ADMIN) {
      return next(new AppError("Admin access required", 403));
    }

    next();
  } catch (error) {
    next(error);
  }
};
