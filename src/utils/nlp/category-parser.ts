export interface CategoryLike {
  id: number;
  name: string;
}

export interface ParsedCategoryCandidate {
  canonical: string;
  raw: string;
  aliases: string[];
}

interface CategoryIntentRule {
  canonical: string;
  aliases: string[];
  patterns: RegExp[];
}

const CATEGORY_INTENT_RULES: CategoryIntentRule[] = [
  {
    canonical: "land",
    aliases: ["land", "plot", "plots", "ghaderi"],
    patterns: [/\bland\b/i, /\bplots?\b/i, /\bghaderi\b/i],
  },
  {
    canonical: "home",
    aliases: ["home", "house", "residential", "apartment", "flat", "villa"],
    patterns: [
      /\bhome\b/i,
      /\bhouse\b/i,
      /\bresidential\b/i,
      /\bapartment\b/i,
      /\bflat\b/i,
      /\bvilla\b/i,
    ],
  },
  {
    canonical: "rent",
    aliases: ["rent", "rental", "lease"],
    patterns: [
      /\bfor rent\b/i,
      /\bon rent\b/i,
      /\brent(?:al)?\b/i,
      /\blease\b/i,
    ],
  },
  {
    canonical: "commercial",
    aliases: ["commercial", "office", "shop", "retail"],
    patterns: [/\bcommercial\b/i, /\boffice\b/i, /\bshop\b/i, /\bretail\b/i],
  },
];

const normalizeToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const scoreCategoryMatch = (categoryName: string, aliases: string[]): number => {
  const normalizedName = normalizeToken(categoryName);
  let bestScore = 0;

  for (const alias of aliases.map(normalizeToken)) {
    if (!alias) {
      continue;
    }

    if (normalizedName === alias) {
      bestScore = Math.max(bestScore, 100);
      continue;
    }

    if (normalizedName.startsWith(`${alias} `) || normalizedName.endsWith(` ${alias}`)) {
      bestScore = Math.max(bestScore, 90);
      continue;
    }

    if (normalizedName.includes(` ${alias} `)) {
      bestScore = Math.max(bestScore, 85);
      continue;
    }

    if (normalizedName.includes(alias) || alias.includes(normalizedName)) {
      bestScore = Math.max(bestScore, 70);
    }
  }

  return bestScore;
};

export const parseCategoryCandidate = (
  brief: string,
): ParsedCategoryCandidate | undefined => {
  for (const rule of CATEGORY_INTENT_RULES) {
    const matchedPattern = rule.patterns.find((pattern) => pattern.test(brief));
    if (!matchedPattern) {
      continue;
    }

    const raw = brief.match(matchedPattern)?.[0] ?? rule.canonical;
    return {
      canonical: rule.canonical,
      raw,
      aliases: rule.aliases,
    };
  }

  return undefined;
};

export const resolveCategoryCandidate = (
  input: string | ParsedCategoryCandidate | undefined,
  categories: CategoryLike[],
): CategoryLike | null => {
  if (!input) {
    return null;
  }

  const aliases =
    typeof input === "string"
      ? [input]
      : [input.canonical, input.raw, ...input.aliases];

  const ranked = categories
    .map((category) => ({
      category,
      score: scoreCategoryMatch(category.name, aliases),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.category ?? null;
};
