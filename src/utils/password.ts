import bcrypt from "bcrypt";
import env from "@config/env";

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, env.auth.bcryptSaltRounds);

export const comparePassword = (
  password: string,
  passwordHash: string,
): Promise<boolean> => bcrypt.compare(password, passwordHash);
