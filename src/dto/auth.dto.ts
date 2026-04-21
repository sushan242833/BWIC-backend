import { UserRole } from "@models/user.model";

export interface RegisterRequestDto {
  fullName: string;
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterResponseDto {
  email: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
  rememberMe?: boolean;
  scope?: UserRole;
}

export interface VerifyEmailRequestDto {
  email: string;
  otp: string;
}

export interface ResendOtpRequestDto {
  email: string;
}

export interface ResendOtpResponseDto {
  email: string;
  resendCooldownSeconds: number;
}

export interface ForgotPasswordRequestDto {
  email: string;
}

export interface ForgotPasswordResponseDto {
  resendCooldownSeconds: number;
}

export interface ValidateResetTokenQueryDto {
  token: string;
}

export interface ValidateResetTokenResponseDto {
  valid: true;
  expiresAt: Date;
}

export interface ResetPasswordRequestDto {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AuthUserDto {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}
