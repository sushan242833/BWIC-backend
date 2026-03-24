import { NextFunction, Request, Response } from "express";
import { Op } from "sequelize";
import sequelize from "@config/config";
import env from "@config/env";
import {
  ForgotPasswordRequestDto,
  LoginRequestDto,
  RegisterRequestDto,
  ResetPasswordRequestDto,
  ValidateResetTokenQueryDto,
} from "@dto/auth.dto";
import { PasswordResetToken } from "@models/password-reset-token.model";
import { User } from "@models/user.model";
import { serializeAuthUser } from "@utils/auth-user";
import { buildPasswordResetEmailTemplate } from "@utils/email-templates/password-reset-email";
import { sendEmail } from "@utils/email";
import { comparePassword, hashPassword } from "@utils/password";
import {
  FORGOT_PASSWORD_SUCCESS_MESSAGE,
  INVALID_RESET_TOKEN_MESSAGE,
  buildPasswordResetLink,
  generatePasswordResetToken,
  hashResetToken,
} from "@utils/password-reset";
import { assertRateLimit } from "@utils/request-rate-limit";
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

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const request = req.body as ForgotPasswordRequestDto;
      const normalizedEmail = normalizeEmail(request.email);
      const requesterIp = req.ip || req.socket.remoteAddress || "unknown";

      assertRateLimit({
        key: `forgot-password:${requesterIp}`,
        maxRequests: env.auth.passwordReset.maxAttemptsPerWindow,
        windowMs:
          env.auth.passwordReset.attemptsWindowMinutes * 60 * 1000,
        message: "Too many password reset requests. Please wait and try again.",
      });

      const user = await User.findOne({
        where: {
          email: normalizedEmail,
          isActive: true,
        },
      });

      if (!user) {
        return this.sendForgotPasswordSuccess(res);
      }

      const now = new Date();
      const cooldownStart = new Date(
        now.getTime() -
          env.auth.passwordReset.resendCooldownSeconds * 1000,
      );

      const recentToken = await PasswordResetToken.findOne({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: {
            [Op.gt]: now,
          },
          createdAt: {
            [Op.gte]: cooldownStart,
          },
        },
        order: [["createdAt", "DESC"]],
      });

      if (recentToken) {
        return this.sendForgotPasswordSuccess(res);
      }

      const { rawToken, tokenHash, expiresAt } = generatePasswordResetToken();

      await sequelize.transaction(async (transaction) => {
        await PasswordResetToken.update(
          { usedAt: now },
          {
            where: {
              userId: user.id,
              usedAt: null,
            },
            transaction,
          },
        );

        await PasswordResetToken.create(
          {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
          { transaction },
        );
      });

      const resetLink = buildPasswordResetLink(rawToken);
      const emailTemplate = buildPasswordResetEmailTemplate({
        recipientName: user.fullName,
        resetLink,
        expiresInMinutes: env.auth.passwordReset.expiryMinutes,
      });

      try {
        await sendEmail({
          to: user.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
        });
      } catch (error) {
        console.error("Failed to send password reset email", error);
        await PasswordResetToken.update(
          { usedAt: new Date() },
          {
            where: {
              userId: user.id,
              tokenHash,
              usedAt: null,
            },
          },
        );
      }

      return this.sendForgotPasswordSuccess(res);
    } catch (error) {
      next(error);
    }
  }

  async validateResetToken(req: Request, res: Response, next: NextFunction) {
    try {
      const request = req.query as unknown as ValidateResetTokenQueryDto;
      const tokenRecord = await PasswordResetToken.findOne({
        where: { tokenHash: hashResetToken(request.token) },
      });

      const user = tokenRecord
        ? await User.findByPk(tokenRecord.userId)
        : null;

      if (
        !tokenRecord ||
        tokenRecord.usedAt ||
        tokenRecord.expiresAt.getTime() <= Date.now() ||
        !user ||
        !user.isActive
      ) {
        return next(new AppError(INVALID_RESET_TOKEN_MESSAGE, 400));
      }

      return sendSuccess(res, {
        message: "Reset token is valid",
        data: {
          valid: true,
          expiresAt: tokenRecord.expiresAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const request = req.body as ResetPasswordRequestDto;

      if (request.newPassword !== request.confirmPassword) {
        return next(new AppError("Passwords do not match", 400));
      }

      const tokenHash = hashResetToken(request.token);
      const newPasswordHash = await hashPassword(request.newPassword);

      await sequelize.transaction(async (transaction) => {
        const tokenRecord = await PasswordResetToken.findOne({
          where: { tokenHash },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        const user = tokenRecord
          ? await User.findByPk(tokenRecord.userId, {
              transaction,
              lock: transaction.LOCK.UPDATE,
            })
          : null;

        if (
          !tokenRecord ||
          tokenRecord.usedAt ||
          tokenRecord.expiresAt.getTime() <= Date.now() ||
          !user ||
          !user.isActive
        ) {
          throw new AppError(INVALID_RESET_TOKEN_MESSAGE, 400);
        }

        user.passwordHash = newPasswordHash;
        await user.save({ transaction });

        await PasswordResetToken.update(
          { usedAt: new Date() },
          {
            where: {
              userId: tokenRecord.userId,
              usedAt: null,
            },
            transaction,
          },
        );
      });

      clearAuthCookie(res);

      return sendSuccess(res, {
        message: "Password reset successful. Please log in with your new password.",
      });
    } catch (error) {
      next(error);
    }
  }

  private sendForgotPasswordSuccess(res: Response) {
    return sendSuccess(res, {
      statusCode: 202,
      message: FORGOT_PASSWORD_SUCCESS_MESSAGE,
      data: {
        resendCooldownSeconds: env.auth.passwordReset.resendCooldownSeconds,
      },
    });
  }
}

export default new AuthController();
