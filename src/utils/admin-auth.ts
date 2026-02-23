import crypto from "crypto";

const TOKEN_TTL_SECONDS = 60 * 60 * 8;

function getAuthConfig() {
  const adminId = process.env.ADMIN_ID || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const tokenSecret = process.env.ADMIN_TOKEN_SECRET || "change-this-secret";

  return { adminId, adminPassword, tokenSecret };
}

export function isValidAdminCredentials(id: string, password: string): boolean {
  const { adminId, adminPassword } = getAuthConfig();
  return id === adminId && password === adminPassword;
}

function toBase64Url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}

function sign(input: string): string {
  const { tokenSecret } = getAuthConfig();
  return crypto
    .createHmac("sha256", tokenSecret)
    .update(input)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function createAdminToken(id: string): string {
  const payload = {
    sub: id,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };

  const payloadPart = toBase64Url(JSON.stringify(payload));
  const signature = sign(payloadPart);

  return `${payloadPart}.${signature}`;
}

export function verifyAdminToken(token: string): { sub: string } | null {
  const [payloadPart, signature] = token.split(".");
  if (!payloadPart || !signature) {
    return null;
  }

  const expectedSignature = sign(payloadPart);

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(payloadPart)) as {
      sub?: string;
      exp?: number;
    };

    if (!parsed.sub || !parsed.exp) {
      return null;
    }

    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return { sub: parsed.sub };
  } catch {
    return null;
  }
}
