import { NextFunction, Request, Response } from "express";
import { LoginRequestDto, RegisterRequestDto } from "@dto/auth.dto";
import { User } from "@models/user.model";
import { serializeAuthUser } from "@utils/auth-user";
import { comparePassword, hashPassword } from "@utils/password";
import {
  clearAuthCookie,
  setAuthCookie,
  signAuthToken,
} from "@utils/token";
import { sendSuccess } from "@utils/api-response";
import { AppError } from "../middleware/error.middleware";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export class AuthController {
  private buildToken(user: User) {
    return signAuthToken({
      sub: String(user.id),
      role: user.role,
      email: user.email,
    });
  }

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const request = req.body as RegisterRequestDto;
      const normalizedEmail = normalizeEmail(request.email);

      const existingUser = await User.findOne({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        return next(new AppError("An account with this email already exists", 409));
      }

      const user = await User.create({
        fullName: request.fullName.trim(),
        email: normalizedEmail,
        passwordHash: await hashPassword(request.password),
        role: "USER",
        isActive: true,
      });

      setAuthCookie(res, this.buildToken(user), request.rememberMe);

      return sendSuccess(res, {
        statusCode: 201,
        message: "Account created successfully",
        data: serializeAuthUser(user),
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const request = req.body as LoginRequestDto;
      const normalizedEmail = normalizeEmail(request.email);

      const user = await User.findOne({
        where: { email: normalizedEmail },
      });

      if (!user) {
        return next(new AppError("Invalid email or password", 401));
      }

      if (!user.isActive) {
        return next(new AppError("Your account is inactive", 403));
      }

      const passwordMatches = await comparePassword(
        request.password,
        user.passwordHash,
      );

      if (!passwordMatches) {
        return next(new AppError("Invalid email or password", 401));
      }

      if (request.scope === "ADMIN" && user.role !== "ADMIN") {
        return next(
          new AppError("This account is not allowed to access the admin portal", 403),
        );
      }

      setAuthCookie(res, this.buildToken(user), request.rememberMe);

      return sendSuccess(res, {
        message: "Login successful",
        data: serializeAuthUser(user),
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(_req: Request, res: Response, next: NextFunction) {
    try {
      clearAuthCookie(res);

      return sendSuccess(res, {
        message: "Logout successful",
      });
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, {
        message: "Current user fetched successfully",
        data: req.user ?? null,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
