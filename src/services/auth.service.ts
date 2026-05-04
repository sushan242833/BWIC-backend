import sequelize from "@config/config";
import authConfig from "@config/auth";
import {
  RegisterRequestDto,
  RegisterResponseDto,
  ResendOtpRequestDto,
  ResendOtpResponseDto,
  VerifyEmailRequestDto,
} from "@dto/auth.dto";
import { USER_ROLE, User } from "@models/user.model";
import { buildEmailVerificationEmailTemplate } from "@utils/email-templates/email-verification-email";
import {
  createEmailVerificationOtp,
  hashEmailVerificationOtp,
} from "@utils/email-verification";
import { sendEmail } from "@utils/email";
import { hashPassword } from "@utils/password";
import { assertRateLimit } from "@utils/request-rate-limit";
import { AppError } from "../middleware/error.middleware";

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const duplicateRegistrationEmailMessage = "Email already exists.";
const genericVerificationFailureMessage =
  "Invalid or expired verification code. Please request a new one and try again.";

const clearEmailVerificationState = (user: User) => {
  user.emailVerificationOtp = null;
  user.emailVerificationOtpExpiresAt = null;
  user.otpAttempts = 0;
};

export class AuthService {
  normalizeEmail(email: string) {
    return normalizeEmail(email);
  }

  async register(request: RegisterRequestDto): Promise<RegisterResponseDto> {
    const normalizedEmail = this.normalizeEmail(request.email);
    const existingUser = await User.findOne({
      where: { email: normalizedEmail },
      attributes: ["id", "isEmailVerified"],
    });

    if (existingUser) {
      throw new AppError(duplicateRegistrationEmailMessage, 409, [
        {
          path: "email",
          message: duplicateRegistrationEmailMessage,
        },
      ]);
    }

    const passwordHash = await hashPassword(request.password);
    const { otp, otpHash, expiresAt } =
      createEmailVerificationOtp(normalizedEmail);

    await sequelize.transaction(async (transaction) => {
      const user = await User.create(
        {
          fullName: request.fullName.trim(),
          email: normalizedEmail,
          passwordHash,
          role: USER_ROLE.USER,
          isActive: true,
          isEmailVerified: false,
          emailVerificationOtp: otpHash,
          emailVerificationOtpExpiresAt: expiresAt,
          otpAttempts: 0,
        },
        { transaction },
      );

      const emailTemplate = buildEmailVerificationEmailTemplate({
        recipientName: user.fullName,
        otp,
        expiresInMinutes: authConfig.emailVerification.expiryMinutes,
      });

      await sendEmail({
        to: user.email,
        subject: emailTemplate.subject,
        text: emailTemplate.text,
        html: emailTemplate.html,
      });
    });

    return {
      email: normalizedEmail,
    };
  }

  async verifyEmail(request: VerifyEmailRequestDto): Promise<void> {
    const normalizedEmail = this.normalizeEmail(request.email);

    await sequelize.transaction(async (transaction) => {
      const user = await User.findOne({
        where: { email: normalizedEmail },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!user) {
        throw new AppError(genericVerificationFailureMessage, 400);
      }

      if (user.isEmailVerified) {
        throw new AppError(genericVerificationFailureMessage, 400);
      }

      if (!user.emailVerificationOtp || !user.emailVerificationOtpExpiresAt) {
        throw new AppError(genericVerificationFailureMessage, 400);
      }

      if (user.emailVerificationOtpExpiresAt.getTime() <= Date.now()) {
        clearEmailVerificationState(user);
        await user.save({ transaction });
        throw new AppError(genericVerificationFailureMessage, 400);
      }

      if (user.otpAttempts >= authConfig.emailVerification.maxVerifyAttempts) {
        clearEmailVerificationState(user);
        await user.save({ transaction });
        throw new AppError(genericVerificationFailureMessage, 400);
      }

      const submittedOtpHash = hashEmailVerificationOtp(
        normalizedEmail,
        request.otp,
      );

      if (submittedOtpHash !== user.emailVerificationOtp) {
        user.otpAttempts += 1;

        if (user.otpAttempts >= authConfig.emailVerification.maxVerifyAttempts) {
          clearEmailVerificationState(user);
          await user.save({ transaction });
          throw new AppError(genericVerificationFailureMessage, 400);
        }

        await user.save({ transaction });
        throw new AppError(genericVerificationFailureMessage, 400);
      }

      user.isEmailVerified = true;
      clearEmailVerificationState(user);
      await user.save({ transaction });
    });
  }

  async resendOtp(
    request: ResendOtpRequestDto,
    requesterIp: string,
  ): Promise<ResendOtpResponseDto> {
    const normalizedEmail = this.normalizeEmail(request.email);

    await assertRateLimit({
      key: `email-verification:resend:${requesterIp}`,
      maxRequests: authConfig.emailVerification.maxAttemptsPerWindow,
      windowMs: authConfig.emailVerification.attemptsWindowMinutes * 60 * 1000,
      message: "Too many OTP resend requests. Please wait and try again.",
    });

    await assertRateLimit({
      key: `email-verification:cooldown:${normalizedEmail}`,
      maxRequests: 1,
      windowMs: authConfig.emailVerification.resendCooldownSeconds * 1000,
      message: "Please wait before requesting a new OTP.",
    });

    const { otp, otpHash, expiresAt } =
      createEmailVerificationOtp(normalizedEmail);

    await sequelize.transaction(async (transaction) => {
      const user = await User.findOne({
        where: { email: normalizedEmail },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!user) {
        return;
      }

      if (user.isEmailVerified) {
        return;
      }

      user.emailVerificationOtp = otpHash;
      user.emailVerificationOtpExpiresAt = expiresAt;
      user.otpAttempts = 0;
      await user.save({ transaction });

      const emailTemplate = buildEmailVerificationEmailTemplate({
        recipientName: user.fullName,
        otp,
        expiresInMinutes: authConfig.emailVerification.expiryMinutes,
      });

      await sendEmail({
        to: user.email,
        subject: emailTemplate.subject,
        text: emailTemplate.text,
        html: emailTemplate.html,
      });
    });

    return {
      email: normalizedEmail,
      resendCooldownSeconds: authConfig.emailVerification.resendCooldownSeconds,
    };
  }
}

export default new AuthService();
