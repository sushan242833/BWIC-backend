const NEPALI_CURRENCY_MULTIPLIERS: Record<string, number> = {
  lakh: 100_000,
  lakhs: 100_000,
  lac: 100_000,
  lacs: 100_000,
  crore: 10_000_000,
  crores: 10_000_000,
  cr: 10_000_000,
};

const normalizeNumericToken = (value: string): string =>
  value.replace(/,/g, "").trim();

export const parseNumberToken = (value: string): number | undefined => {
  const normalized = normalizeNumericToken(value);
  if (!normalized) {
    return undefined;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const parseNepaliCurrency = (value: string): number | undefined => {
  const match = value
    .trim()
    .match(/(\d[\d,]*(?:\.\d+)?)\s*(crores?|crore|cr|lakhs?|lakh|lacs?|lac)?\b/i);

  const amount = match?.[1];
  if (!amount) {
    return undefined;
  }

  const parsedAmount = parseNumberToken(amount);
  if (parsedAmount === undefined) {
    return undefined;
  }

  const unit = match?.[2]?.toLowerCase();
  if (!unit) {
    return parsedAmount;
  }

  return parsedAmount * (NEPALI_CURRENCY_MULTIPLIERS[unit] ?? 1);
};

export const parseAreaValue = (value: string): number | undefined =>
  parseNumberToken(value);

export const parseDistanceKmValue = (value: string): number | undefined =>
  parseNumberToken(value);
