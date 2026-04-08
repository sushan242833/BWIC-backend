import https from "https";
import { appConfig } from "@config/app";
import env from "@config/env";
import {
  aiRecommendationExtractionJsonSchema,
  parseAIRecommendationExtraction,
  type AIRecommendationExtraction,
} from "@utils/ai/recommendation-ai-schema";

interface ChatCompletionMessage {
  role: "system" | "user";
  content: string;
}

interface OpenAIChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  temperature: number;
  response_format: {
    type: "json_schema";
    json_schema: typeof aiRecommendationExtractionJsonSchema;
  };
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | Array<{ type?: string; text?: string }> | null;
      refusal?: string | null;
    };
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

export interface AIQueryUnderstandingResult {
  extraction: AIRecommendationExtraction;
  source: "ai";
}

export interface AIQueryUnderstandingServiceOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  enabled?: boolean;
  requestChatCompletion?: (
    payload: OpenAIChatCompletionRequest,
  ) => Promise<string | null>;
}

const SYSTEM_PROMPT = `
You extract structured real-estate search intent for Nepal property recommendation queries.

Return JSON only. Do not explain anything outside JSON.

Rules:
- Interpret Nepali real-estate language such as home, house, apartment, flat, land, plot, ghaderi, lakh, crore, Kathmandu, Lalitpur, Bhaktapur, Baneshwor, Kalanki, Koteshwor, Bafal, Gongabu, and landmarks like schools or hospitals.
- The user may write in Nepali, English, Hindi, Hinglish, Chinese, Japanese, or any other language, including mixed-language or mixed-script text.
- Understand non-Latin scripts and translate mentally before extraction.
- Return all string fields in English or common Romanized Nepal place names using Latin characters so downstream filters can use them consistently.
- Normalize translated or transliterated equivalents to the same intent. For example, return "Kathmandu" instead of "काठमाडौं", return "home" instead of "घर", and prefer Latin-script Nepal place names over non-Latin output.
- Understand numbers written in Arabic digits, Devanagari digits, and language-specific number words when the meaning is clear.
- The place names above are examples only, not a fixed list. Do not limit extraction to predefined locations.
- Understand arbitrary Nepal locations and anchors such as municipalities, wards, toles, chowks, bazaars, bus parks, ring road areas, roads, gates, temples, schools, colleges, hospitals, offices, bridges, and other landmarks when the query supports them.
- Handle spelling variations, transliteration differences, abbreviations, and minor typos without requiring an exact hardcoded match.
- When returning location.value, keep only the actual place or landmark phrase and remove cue words like in, at, near, nearby, around, or close to, along with unrelated budget or property-type words.
- Prefer the most specific supported place or landmark phrase from the query instead of a broader city if both are mentioned.
- Do not reject a location just because it is uncommon, unseen, or phrased as a landmark rather than an administrative area.
- Return price fields in integer Nepalese rupees (NPR).
- Convert lakh/crore mentions into integer NPR values.
- Return area fields in square feet.
- Convert Nepali land units before returning area fields.
- Distance from highway should be in kilometers, but if the query implies a very close distance without specifying units, interpret that as maxDistanceFromHighway=1 km, if says 200m then maxDistanceFromHighway=0.2 km.
- Hills conversion table: 1 ropani = 5476 sq ft, 1 aana/anna = 342.25 sq ft, 1 paisa = 85.5625 sq ft, 1 daam/dam = 21.390625 sq ft.
- Terai conversion table: 1 bigha = 72900 sq ft, 1 kattha/katha = 3645 sq ft, 1 dhur = 182.25 sq ft.
- Never return area in square meters for this API.
- Detect any currency from all over the world but convert and return all price fields in integer NPR.
- Use location.mode="strict" for direct location filters like "in kathmandu" or "at lalitpur".
- Use location.mode="nearby" for softer proximity phrases like "near bafal", "around kalanki", "close to baneshwor", or landmark-style nearby references.
- Use location.mode="soft" only when a location preference exists but the cue is weak.
- If a field is not present or uncertain, return null for that field.
- Do not invent facts. Only extract what is supported by the query.
- Use preferredRoi for qualitative ROI hints without an explicit number.
- Map "good roi", "high roi", or "strong roi" to preferredRoi=12.
- Map "very high roi" to preferredRoi=15.
- Map "easy access to highway", "near highway", "close to highway", or similar phrases without an explicit distance to maxDistanceFromHighway=1.
- Schools, hospitals, chowks, landmarks, and local areas are valid locations or landmark preferences except for around 200 m from highway as we have that for distance from highway. Do not reject them.
`.trim();

const buildUserPrompt = (brief: string) =>
  `The query may be written in any language or mixed languages. Extract structured intent from this Nepal real-estate recommendation query:\n${brief}`;

const normalizeBaseUrl = (value: string): string =>
  value.endsWith("/") ? value : `${value}/`;

const toRequestUrl = (baseUrl: string): URL =>
  new URL("chat/completions", normalizeBaseUrl(baseUrl));

const readMessageContent = (
  content: string | Array<{ type?: string; text?: string }> | null | undefined,
): string | null => {
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed || null;
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const text = content
    .map((part) => part.text?.trim())
    .filter((part): part is string => Boolean(part))
    .join("");

  return text || null;
};

const createChatCompletionRequester = (options: {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
}) => {
  const requestUrl = toRequestUrl(options.baseUrl);

  return (payload: OpenAIChatCompletionRequest): Promise<string | null> =>
    new Promise((resolve) => {
      const body = JSON.stringify(payload);
      const request = https.request(
        requestUrl,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
        },
        (response) => {
          let data = "";

          response.on("data", (chunk) => {
            data += chunk;
          });

          response.on("end", () => {
            try {
              const parsed = JSON.parse(data) as OpenAIChatCompletionResponse;

              if (
                !response.statusCode ||
                response.statusCode < 200 ||
                response.statusCode >= 300
              ) {
                const errorMessage =
                  parsed.error?.message ||
                  `OpenAI request failed with status ${response.statusCode}`;
                console.warn(`[ai-query] ${errorMessage}`);
                resolve(null);
                return;
              }

              const choice = parsed.choices?.[0];
              if (!choice) {
                console.warn("[ai-query] OpenAI returned no choices");
                resolve(null);
                return;
              }

              if (choice.message?.refusal) {
                console.warn(
                  `[ai-query] Model refused extraction: ${choice.message.refusal}`,
                );
                resolve(null);
                return;
              }

              if (choice.finish_reason === "length") {
                console.warn(
                  "[ai-query] OpenAI response was truncated before extraction completed",
                );
                resolve(null);
                return;
              }

              resolve(readMessageContent(choice.message?.content));
            } catch (error) {
              console.warn(
                `[ai-query] Failed to parse OpenAI response payload: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`,
              );
              resolve(null);
            }
          });
        },
      );

      request.setTimeout(options.timeoutMs, () => {
        request.destroy();
        console.warn(
          `[ai-query] OpenAI extraction timed out after ${options.timeoutMs}ms`,
        );
        resolve(null);
      });

      request.on("error", (error) => {
        console.warn(
          `[ai-query] OpenAI extraction request failed: ${error.message}`,
        );
        resolve(null);
      });

      request.write(body);
      request.end();
    });
};

const hasStructuredOutput = (value: AIRecommendationExtraction): boolean =>
  Boolean(
    value.category ||
    value.location?.value ||
    value.maxPrice !== undefined ||
    value.minPrice !== undefined ||
    value.bedrooms !== undefined ||
    value.bathrooms !== undefined ||
    value.parking !== undefined ||
    value.furnished !== undefined ||
    value.minArea !== undefined ||
    value.preferredArea !== undefined ||
    value.minRoi !== undefined ||
    value.preferredRoi !== undefined ||
    value.maxDistanceFromHighway !== undefined ||
    value.landmarkPreference ||
    value.status,
  );

export class AIQueryUnderstandingService {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly enabled: boolean;
  private readonly requestChatCompletion: (
    payload: OpenAIChatCompletionRequest,
  ) => Promise<string | null>;
  private hasLoggedConfigurationFallback = false;

  constructor(options: AIQueryUnderstandingServiceOptions = {}) {
    this.apiKey = options.apiKey ?? env.ai.apiKey;
    this.baseUrl = options.baseUrl ?? env.ai.baseUrl;
    this.model =
      options.model ?? env.ai.model ?? appConfig.aiQuery.defaultModel;
    this.timeoutMs =
      options.timeoutMs ?? env.ai.timeoutMs ?? appConfig.aiQuery.timeoutMs;
    this.enabled = options.enabled ?? env.ai.enabled;
    this.requestChatCompletion =
      options.requestChatCompletion ??
      (this.apiKey
        ? createChatCompletionRequester({
            apiKey: this.apiKey,
            baseUrl: this.baseUrl,
            timeoutMs: this.timeoutMs,
          })
        : async () => null);
  }

  private canUseAI(): boolean {
    if (!this.enabled) {
      return false;
    }

    if (this.apiKey) {
      return true;
    }

    if (!this.hasLoggedConfigurationFallback) {
      console.warn(
        "[ai-query] OPENAI_API_KEY is not configured, so recommendation brief parsing from the free-text field will be skipped.",
      );
      this.hasLoggedConfigurationFallback = true;
    }

    return false;
  }

  async extractRecommendationQuery(
    brief?: string,
  ): Promise<AIQueryUnderstandingResult | null> {
    const normalizedBrief = brief?.trim().replace(/\s+/g, " ");
    if (!normalizedBrief || !this.canUseAI()) {
      return null;
    }

    try {
      const content = await this.requestChatCompletion({
        model: this.model,
        temperature: appConfig.aiQuery.temperature,
        response_format: {
          type: "json_schema",
          json_schema: aiRecommendationExtractionJsonSchema,
        },
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: buildUserPrompt(normalizedBrief),
          },
        ],
      });

      if (!content) {
        return null;
      }

      const parsedContent = JSON.parse(content) as unknown;
      const extraction = parseAIRecommendationExtraction(parsedContent);

      if (!extraction || !hasStructuredOutput(extraction)) {
        console.warn(
          `[ai-query] AI extraction returned no valid structured intent for: "${normalizedBrief}"`,
        );
        return null;
      }

      return {
        extraction,
        source: "ai",
      };
    } catch (error) {
      console.warn(
        `[ai-query] AI extraction failed for "${normalizedBrief}": ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      return null;
    }
  }
}

export default new AIQueryUnderstandingService();
