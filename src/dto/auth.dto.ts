import { UserRole } from "@models/user.model";

export interface RegisterRequestDto {
  fullName: string;
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginRequestDto {
  email: string;
  password: string;
  rememberMe?: boolean;
  scope?: UserRole;
}

export interface AuthUserDto {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
