const NEPALI_CURRENCY_MULTIPLIERS: Record<string, number> = {
  lakh: 100_000,
  lakhs: 100_000,
  lac: 100_000,
  lacs: 100_000,
  crore: 10_000_000,
  crores: 10_000_000,
  cr: 10_000_000,
};

const AREA_UNIT_MULTIPLIERS: Record<string, number> = {
  "sq ft": 1,
  sqft: 1,
  "square feet": 1,
  ft2: 1,
  "ft²": 1,
  ropani: 5_476,
  ropanis: 5_476,
  aana: 342.25,
  aanas: 342.25,
  anna: 342.25,
  annas: 342.25,
  paisa: 85.5625,
  paisas: 85.5625,
  daam: 21.390625,
  daams: 21.390625,
  dam: 21.390625,
  dams: 21.390625,
  kattha: 3_645,
  katthas: 3_645,
  katha: 3_645,
  kathas: 3_645,
  bigha: 72_900,
  bighas: 72_900,
  dhur: 182.25,
  dhurs: 182.25,
};

export const AREA_UNIT_PATTERN_SOURCE =
  "sq\\.?\\s*ft|sqft|square\\s*feet|ft2|ft²|ropanis?|ropani|aana|aana?s?|anna|annas?|paisa|paisas?|daam|daams?|dam|dams?|kattha|katthas?|katha|kathas?|bigha|bighas?|dhur|dhurs?";

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
  (() => {
    const match = value.trim().match(
      new RegExp(
        `^(\\d[\\d,]*(?:\\.\\d+)?)\\s*(${AREA_UNIT_PATTERN_SOURCE})?$`,
        "i",
      ),
    );

    const amount = match?.[1] ?? value;
    const parsedAmount = parseNumberToken(amount);
    if (parsedAmount === undefined) {
      return undefined;
    }

    const rawUnit = match?.[2]
      ?.toLowerCase()
      .replace(/\./g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!rawUnit) {
      return parsedAmount;
    }

    return parsedAmount * (AREA_UNIT_MULTIPLIERS[rawUnit] ?? 1);
  })();

export const parseDistanceKmValue = (value: string): number | undefined =>
  parseNumberToken(value);
