import bcrypt from "bcrypt";
import authConfig from "@config/auth";

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, authConfig.bcryptSaltRounds);

export const comparePassword = (
  password: string,
  passwordHash: string,
): Promise<boolean> => bcrypt.compare(password, passwordHash);
