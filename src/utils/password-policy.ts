export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export const STRONG_PASSWORD_MESSAGE =
  "Password must include uppercase, lowercase, number, and special character.";

const strongPasswordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;

export const isStrongPassword = (password: string): boolean =>
  strongPasswordPattern.test(password);
