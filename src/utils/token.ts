import { CookieOptions, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import authConfig from "@config/auth";
import env from "@config/env";
import { UserRole } from "@models/user.model";

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
  email: string;
  tokenVersion: number;
}

const baseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: env.auth.cookieSameSite,
  secure: env.auth.cookieSecure,
  domain: env.auth.cookieDomain || undefined,
  path: "/",
});

export const authCookieName = authConfig.cookieName;

export const signAuthToken = (payload: AuthTokenPayload): string =>
  jwt.sign(payload, env.auth.jwtSecret, {
    algorithm: "HS256",
    expiresIn: authConfig.tokenTtl as SignOptions["expiresIn"],
  });

export const verifyAuthToken = (token: string): AuthTokenPayload =>
  jwt.verify(token, env.auth.jwtSecret, {
    algorithms: ["HS256"],
  }) as AuthTokenPayload;

export const setAuthCookie = (
  res: Response,
  token: string,
  rememberMe = false,
) => {
  res.cookie(authCookieName, token, {
    ...baseCookieOptions(),
    maxAge: rememberMe
      ? authConfig.rememberCookieMaxAgeMs
      : authConfig.cookieMaxAgeMs,
  });
};

export const clearAuthCookie = (res: Response) => {
  res.clearCookie(authCookieName, baseCookieOptions());
};
