import type {
  RecommendationDetectedLocationDto,
  RecommendationLocationMode,
} from "@dto/recommendation.dto";

export interface LocationSearchProfile {
  value: string;
  normalizedValue: string;
  aliases: string[];
  normalizedAliases: string[];
  tokens: string[];
  significantTokens: string[];
}

export interface ParsedLocationCandidate
  extends RecommendationDetectedLocationDto,
    LocationSearchProfile {}

type LocationTextField = "location" | "title" | "description";

export interface LocationTextSource {
  location?: string | null;
  title?: string | null;
  description?: string | null;
}

export interface LocationTextMatchResult {
  matched: boolean;
  ratio: number;
  field?: LocationTextField;
  strength: "direct" | "alias" | "tokens" | "none";
  reason: string;
  matchedVariant?: string;
}

interface LocationPatternRule {
  mode: RecommendationLocationMode;
  baseConfidence: number;
  matchReason: string;
  pattern: RegExp;
}

const LOCATION_CUE_CORRECTIONS: Array<[RegExp, string]> = [
  [/\bneaa\b/gi, "near"],
  [/\bnera\b/gi, "near"],
  [/\bneer\b/gi, "near"],
  [/\bnearr\b/gi, "near"],
  [/\bnar\b/gi, "near"],
  [/\barround\b/gi, "around"],
  [/\baroud\b/gi, "around"],
  [/\bclsoe\s+to\b/gi, "close to"],
  [/\bcloes\s+to\b/gi, "close to"],
  [/\bclosee\s+to\b/gi, "close to"],
  [/\bnear\s+by\b/gi, "nearby"],
];

const LOCATION_FIELD_PRIORITY: LocationTextField[] = [
  "location",
  "title",
  "description",
];

const DIRECT_MATCH_RATIOS: Record<LocationTextField, number> = {
  location: 1,
  title: 0.9,
  description: 0.78,
};

const ALIAS_MATCH_RATIOS: Record<LocationTextField, number> = {
  location: 0.95,
  title: 0.86,
  description: 0.74,
};

const TOKEN_MATCH_RATIOS: Record<LocationTextField, number> = {
  location: 0.72,
  title: 0.66,
  description: 0.58,
};

const LOCATION_ALIAS_MAP: Record<string, string[]> = {
  kathmandu: ["ktm", "kathmandu metropolitan city"],
  lalitpur: ["patan", "lalitpur metropolitan city"],
  bhaktapur: ["bhadgaon", "bhaktapur municipality"],
  swayambhu: ["swoyambhu", "swayambhunath", "swoyambhunath"],
  koteshwor: ["koteshwar", "koteshor"],
  imadol: ["imadole"],
  baneshwor: ["baneshwor", "baneswor"],
  "new baneshwor": ["new baneshwor", "new baneswor"],
  "old baneshwor": ["old baneshwor", "old baneswor"],
  gongabu: ["new bus park", "new buspark", "gongabu bus park"],
  baluwatar: ["baluwater"],
};

const LOCATION_GENERIC_TERMS = new Set([
  "a",
  "an",
  "anywhere",
  "apartment",
  "area",
  "bathroom",
  "bathrooms",
  "bedroom",
  "bedrooms",
  "best",
  "bhk",
  "budget",
  "buy",
  "city",
  "commercial",
  "crore",
  "description",
  "district",
  "flat",
  "for",
  "good",
  "highway",
  "home",
  "hospital",
  "house",
  "land",
  "lakh",
  "location",
  "me",
  "nearby",
  "office",
  "parking",
  "place",
  "plot",
  "price",
  "property",
  "residential",
  "road",
  "roi",
  "sale",
  "school",
  "shop",
  "sqft",
  "street",
  "under",
  "villa",
  "with",
]);

const LOCATION_CAPTURE_TAIL =
  "(?=\\s+(?:under|below|less than|up to|upto|within|with|without|near|nearby|around|close(?:\\s+to|\\s+by)?|about|approximately|approx(?:imately)?|roughly|budget|priced?|cost(?:ing)?|for|having|and|or|at|max(?:imum)?|minimum|min|over|above|roi|return|km|kilometers?|kilometres?|sq\\.?\\s*ft|sqft|square\\s*feet|ft2|ft²|bhk|bedrooms?|bathrooms?|parking|available|sale|sold|rented|pending)\\b|[,.!?]|$)";

const LOCATION_PATTERNS: LocationPatternRule[] = [
  {
    mode: "strict",
    baseConfidence: 0.94,
    matchReason:
      "Detected a direct location phrase introduced by a strong preposition.",
    pattern: new RegExp(
      `\\b(?:in|at)\\s+([a-z][a-z\\s,'-]{1,80}?)${LOCATION_CAPTURE_TAIL}`,
      "gi",
    ),
  },
  {
    mode: "nearby",
    baseConfidence: 0.82,
    matchReason:
      "Detected a softer proximity phrase introduced by nearby wording.",
    pattern: new RegExp(
      `\\b(?:near|around|close\\s+to|close\\s+by|nearby)\\s+([a-z][a-z\\s,'-]{1,80}?)${LOCATION_CAPTURE_TAIL}`,
      "gi",
    ),
  },
];

export const normalizeLocationText = (value?: string): string =>
  (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const REVERSE_LOCATION_ALIAS_MAP = Object.entries(LOCATION_ALIAS_MAP).reduce<
  Record<string, string>
>((accumulator, [canonical, aliases]) => {
  const normalizedCanonical = normalizeLocationText(canonical);
  accumulator[normalizedCanonical] = normalizedCanonical;

  for (const alias of aliases) {
    accumulator[normalizeLocationText(alias)] = normalizedCanonical;
  }

  return accumulator;
}, {});

const dedupeStrings = (values: string[]): string[] =>
  Array.from(new Set(values.filter(Boolean)));

const normalizeLocationCueText = (brief: string): string =>
  LOCATION_CUE_CORRECTIONS.reduce(
    (current, [pattern, replacement]) =>
      current.replace(pattern, replacement),
    brief,
  );

const toLocationLabel = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const sanitizeLocationFragment = (value?: string): string =>
  (value || "")
    .trim()
    .replace(/^[,.\s-]+|[,.\s-]+$/g, "")
    .replace(/^the\s+/i, "")
    .replace(/\s+/g, " ");

const buildHeuristicVariants = (value: string): string[] => {
  if (!value) {
    return [];
  }

  const variants = [value];

  if (value.includes("shwor")) {
    variants.push(value.replace(/shwor/g, "shwar"));
    variants.push(value.replace(/shwor/g, "swor"));
    variants.push(value.replace(/shwor/g, "swar"));
  }

  if (value.includes("shwar")) {
    variants.push(value.replace(/shwar/g, "shwor"));
  }

  if (value.includes("swor")) {
    variants.push(value.replace(/swor/g, "shwor"));
  }

  if (value.includes("chowk")) {
    variants.push(value.replace(/chowk/g, "chok"));
  }

  if (value.includes("chok")) {
    variants.push(value.replace(/chok/g, "chowk"));
  }

  if (value.endsWith("dol")) {
    variants.push(`${value}e`);
  }

  if (value.endsWith("dole")) {
    variants.push(value.slice(0, -1));
  }

  if (value.includes("bus park")) {
    variants.push(value.replace(/bus park/g, "buspark"));
  }

  if (value.includes("buspark")) {
    variants.push(value.replace(/buspark/g, "bus park"));
  }

  return dedupeStrings(variants);
};

const resolveCanonicalLocation = (normalizedValue: string): string =>
  REVERSE_LOCATION_ALIAS_MAP[normalizedValue] || normalizedValue;

const getLocationTokens = (value: string): string[] =>
  value.split(" ").filter(Boolean);

const getSignificantLocationTokens = (value: string): string[] =>
  getLocationTokens(value).filter(
    (token) =>
      token.length > 2 &&
      !LOCATION_GENERIC_TERMS.has(token) &&
      !/^\d+$/.test(token),
  );

const isMeaningfulLocation = (normalizedValue: string): boolean => {
  if (!normalizedValue || normalizedValue.length < 3) {
    return false;
  }

  const tokens = getLocationTokens(normalizedValue);
  if (tokens.length === 0 || tokens.length > 5) {
    return false;
  }

  if (tokens.every((token) => LOCATION_GENERIC_TERMS.has(token))) {
    return false;
  }

  return getSignificantLocationTokens(normalizedValue).length > 0;
};

const formatLocationMatchReason = (
  field: LocationTextField,
  strength: "direct" | "alias" | "tokens",
): string => {
  const fieldLabel =
    field === "location"
      ? "the listed location"
      : field === "title"
        ? "the property title"
        : "the property description";

  if (strength === "direct") {
    return `Matched your preferred area directly in ${fieldLabel}`;
  }

  if (strength === "alias") {
    return `Matched a known variant of your preferred area in ${fieldLabel}`;
  }

  return `Matched the key terms of your preferred area in ${fieldLabel}`;
};

const computeLocationConfidence = (
  normalizedValue: string,
  baseConfidence: number,
): number => {
  let confidence = baseConfidence;
  const canonical = resolveCanonicalLocation(normalizedValue);
  const tokens = getLocationTokens(normalizedValue);

  if (canonical !== normalizedValue) {
    confidence += 0.08;
  }

  if (tokens.length >= 2 && tokens.length <= 3) {
    confidence += 0.03;
  }

  if (tokens.some((token) => LOCATION_GENERIC_TERMS.has(token))) {
    confidence -= 0.08;
  }

  return Math.max(0.45, Math.min(0.99, Math.round(confidence * 100) / 100));
};

export const buildLocationSearchProfile = (
  value?: string,
): LocationSearchProfile | undefined => {
  const sanitizedValue = sanitizeLocationFragment(value);
  const normalizedValue = normalizeLocationText(sanitizedValue);
  if (!isMeaningfulLocation(normalizedValue)) {
    return undefined;
  }

  const canonicalValue = resolveCanonicalLocation(normalizedValue);
  const normalizedAliases = dedupeStrings([
    normalizedValue,
    canonicalValue,
    ...(LOCATION_ALIAS_MAP[canonicalValue] || []).map(normalizeLocationText),
    ...buildHeuristicVariants(normalizedValue).map(normalizeLocationText),
    ...buildHeuristicVariants(canonicalValue).map(normalizeLocationText),
  ]).filter(isMeaningfulLocation);

  const displayValue =
    canonicalValue !== normalizedValue
      ? toLocationLabel(canonicalValue)
      : toLocationLabel(sanitizedValue);

  const aliases = normalizedAliases
    .filter((candidate) => candidate !== canonicalValue)
    .map(toLocationLabel);

  const significantTokens = dedupeStrings(
    normalizedAliases.reduce<string[]>(
      (allTokens, candidate) => [
        ...allTokens,
        ...getSignificantLocationTokens(candidate),
      ],
      [],
    ),
  );

  return {
    value: displayValue,
    normalizedValue: canonicalValue,
    aliases,
    normalizedAliases,
    tokens: getLocationTokens(canonicalValue),
    significantTokens,
  };
};

export const parseLocationCandidates = (
  brief: string,
): ParsedLocationCandidate[] => {
  const normalizedBrief = normalizeLocationCueText(brief);
  const candidates: Array<ParsedLocationCandidate & { index: number }> = [];

  for (const rule of LOCATION_PATTERNS) {
    rule.pattern.lastIndex = 0;

    let match = rule.pattern.exec(normalizedBrief);
    while (match) {
      const raw = sanitizeLocationFragment(match[1]);
      const profile = buildLocationSearchProfile(raw);

      if (profile) {
        const candidate: ParsedLocationCandidate & { index: number } = {
          raw,
          value: profile.value,
          normalizedValue: profile.normalizedValue,
          aliases: profile.aliases,
          normalizedAliases: profile.normalizedAliases,
          tokens: profile.tokens,
          significantTokens: profile.significantTokens,
          mode: rule.mode,
          confidence: computeLocationConfidence(
            profile.normalizedValue,
            rule.baseConfidence,
          ),
          matchReason: rule.matchReason,
          index: match.index,
        };

        const exists = candidates.some(
          (current) =>
            current.mode === candidate.mode &&
            current.normalizedValue === candidate.normalizedValue,
        );

        if (!exists) {
          candidates.push(candidate);
        }
      }

      match = rule.pattern.exec(normalizedBrief);
    }
  }

  return candidates
    .sort((left, right) => left.index - right.index)
    .map(({ index, ...candidate }) => candidate);
};

export const parseLocationCandidate = (
  brief: string,
): ParsedLocationCandidate | undefined => parseLocationCandidates(brief)[0];

export const matchLocationText = (
  source: LocationTextSource,
  location: string | LocationSearchProfile | undefined,
): LocationTextMatchResult => {
  const profile =
    typeof location === "string"
      ? buildLocationSearchProfile(location)
      : location;

  if (!profile) {
    return {
      matched: false,
      ratio: 0,
      strength: "none",
      reason: "No valid preferred location was available for matching",
    };
  }

  let bestMatch: LocationTextMatchResult = {
    matched: false,
    ratio: 0,
    strength: "none",
    reason: "Did not find your preferred area in the available location text",
  };

  for (const field of LOCATION_FIELD_PRIORITY) {
    const normalizedFieldValue = normalizeLocationText(source[field] || "");
    if (!normalizedFieldValue) {
      continue;
    }

    for (const variant of profile.normalizedAliases) {
      if (!normalizedFieldValue.includes(variant)) {
        continue;
      }

      const strength =
        variant === profile.normalizedValue ? "direct" : "alias";
      const ratio =
        strength === "direct"
          ? DIRECT_MATCH_RATIOS[field]
          : ALIAS_MATCH_RATIOS[field];

      if (ratio > bestMatch.ratio) {
        bestMatch = {
          matched: true,
          ratio,
          field,
          strength,
          matchedVariant: variant,
          reason: formatLocationMatchReason(field, strength),
        };
      }
    }

    if (
      !bestMatch.matched &&
      profile.significantTokens.length > 1 &&
      profile.significantTokens.every((token) => normalizedFieldValue.includes(token))
    ) {
      bestMatch = {
        matched: true,
        ratio: TOKEN_MATCH_RATIOS[field],
        field,
        strength: "tokens",
        reason: formatLocationMatchReason(field, "tokens"),
      };
    }
  }

  return bestMatch;
};
