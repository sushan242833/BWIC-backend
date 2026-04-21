import { AuthUserDto } from "@dto/auth.dto";
import { User } from "@models/user.model";

export const serializeAuthUser = (user: User): AuthUserDto => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  isEmailVerified: user.isEmailVerified,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
