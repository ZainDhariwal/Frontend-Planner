import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject as sdkGenerateObject } from "ai";

interface ModelAttemptConfig {
  keyType: "custom" | "system";
  apiKey: string;
  modelName: string;
  modelInstance: any;
}

/**
 * Validates that a key is present and not a placeholder.
 */
function isValidKey(key?: string): boolean {
  if (!key) return false;
  const k = key.trim();
  return k !== "" && !k.toLowerCase().includes("your_actual") && !k.toLowerCase().includes("key_here");
}

/**
 * Returns the failover sequence of keys and models.
 * First tries custom paid key (highest model -> lower model),
 * then falls back to system key (highest model -> lower model).
 */
function getAttemptsForProvider(
  provider: string,
  customApiKey: string | null
): ModelAttemptConfig[] {
  const attempts: ModelAttemptConfig[] = [];

  if (provider === "gemini") {
    // 1. Custom Key attempts
    if (customApiKey && isValidKey(customApiKey)) {
      const googleCustom = createGoogleGenerativeAI({ apiKey: customApiKey });
      attempts.push({
        keyType: "custom",
        apiKey: customApiKey,
        modelName: "gemini-2.5-pro",
        modelInstance: googleCustom("gemini-2.5-pro"),
      });
      attempts.push({
        keyType: "custom",
        apiKey: customApiKey,
        modelName: "gemini-2.5-flash",
        modelInstance: googleCustom("gemini-2.5-flash"),
      });
    }

    // 2. System Key attempts
    const systemKey = process.env.GEMINI_API_KEY;
    if (isValidKey(systemKey) && systemKey !== customApiKey) {
      const googleSystem = createGoogleGenerativeAI({ apiKey: systemKey! });
      attempts.push({
        keyType: "system",
        apiKey: systemKey!,
        modelName: "gemini-2.5-pro",
        modelInstance: googleSystem("gemini-2.5-pro"),
      });
      attempts.push({
        keyType: "system",
        apiKey: systemKey!,
        modelName: "gemini-2.5-flash",
        modelInstance: googleSystem("gemini-2.5-flash"),
      });
    }
  } else {
    // Anthropic
    // 1. Custom Key attempts
    if (customApiKey && isValidKey(customApiKey)) {
      const anthropicCustom = createAnthropic({ apiKey: customApiKey });
      attempts.push({
        keyType: "custom",
        apiKey: customApiKey,
        modelName: "claude-3-5-sonnet",
        modelInstance: anthropicCustom("claude-3-5-sonnet-20241022"),
      });
      attempts.push({
        keyType: "custom",
        apiKey: customApiKey,
        modelName: "claude-3-5-haiku",
        modelInstance: anthropicCustom("claude-3-5-haiku-20241022"),
      });
    }

    // 2. System Key attempts
    const systemKey = process.env.ANTHROPIC_API_KEY;
    if (isValidKey(systemKey) && systemKey !== customApiKey) {
      const anthropicSystem = createAnthropic({ apiKey: systemKey! });
      attempts.push({
        keyType: "system",
        apiKey: systemKey!,
        modelName: "claude-3-5-sonnet",
        modelInstance: anthropicSystem("claude-3-5-sonnet-20241022"),
      });
      attempts.push({
        keyType: "system",
        apiKey: systemKey!,
        modelName: "claude-3-5-haiku",
        modelInstance: anthropicSystem("claude-3-5-haiku-20241022"),
      });
    }
  }

  return attempts;
}

/**
 * Calculates the estimated monetary cost of the LLM generation.
 * Pricing models (per token):
 * - Google Gemini Pro:
 *   - Input: $1.25 per 1M tokens ($0.00000125 / token)
 *   - Output: $5.00 per 1M tokens ($0.000005 / token)
 * - Google Gemini Flash:
 *   - Input: $0.075 per 1M tokens ($0.000000075 / token)
 *   - Output: $0.30 per 1M tokens ($0.0000003 / token)
 * - Anthropic Claude 3.5 Sonnet:
 *   - Input: $3.00 per 1M tokens ($0.000003 / token)
 *   - Output: $15.00 per 1M tokens ($0.000015 / token)
 * - Anthropic Claude 3.5 Haiku:
 *   - Input: $0.80 per 1M tokens ($0.0000008 / token)
 *   - Output: $4.00 per 1M tokens ($0.000004 / token)
 */
export function calculateCost(
  provider: string,
  modelName: string,
  inputTokens: number = 0,
  outputTokens: number = 0
): number {
  if (provider === "gemini") {
    if (modelName.includes("pro")) {
      const inputCost = inputTokens * 0.00000125;
      const outputCost = outputTokens * 0.000005;
      return Number((inputCost + outputCost).toFixed(6));
    } else {
      const inputCost = inputTokens * 0.000000075;
      const outputCost = outputTokens * 0.0000003;
      return Number((inputCost + outputCost).toFixed(8));
    }
  } else {
    if (modelName.includes("sonnet")) {
      const inputCost = inputTokens * 0.000003;
      const outputCost = outputTokens * 0.000015;
      return Number((inputCost + outputCost).toFixed(6));
    } else {
      const inputCost = inputTokens * 0.0000008;
      const outputCost = outputTokens * 0.000004;
      return Number((inputCost + outputCost).toFixed(6));
    }
  }
}

/**
 * Executes generateObject with built-in key and model fallback (failover).
 * It automatically logs errors and retries using the fallback configurations.
 */
export async function generateObjectWithFallback(
  provider: string,
  customApiKey: string | null,
  options: any
): Promise<any> {
  const attempts = getAttemptsForProvider(provider, customApiKey);
  if (attempts.length === 0) {
    throw new Error(
      `No valid API key found for provider: ${provider}. Please configure it in settings or the environment variables.`
    );
  }

  let lastError: any = null;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    try {
      console.log(
        `[LLM Orchestrator] Invoking model: ${attempt.modelName} using ${attempt.keyType} key (Attempt ${i + 1}/${attempts.length})`
      );
      const result = await sdkGenerateObject({
        ...options,
        model: attempt.modelInstance,
      });

      const cost = attempt.keyType === "system"
        ? 0
        : calculateCost(
            provider,
            attempt.modelName,
            result.usage.inputTokens,
            result.usage.outputTokens
          );

      return {
        object: result.object,
        usage: result.usage,
        warnings: result.warnings,
        modelUsed: attempt.modelName,
        keyTypeUsed: attempt.keyType,
        cost,
      };
    } catch (error: any) {
      lastError = error;
      console.error(
        `[LLM Orchestrator] Model: ${attempt.modelName} (${attempt.keyType} key) failed:`,
        error.message || error
      );

      // If we have a fallback model/key available, try the next one
      if (i < attempts.length - 1) {
        const nextAttempt = attempts[i + 1];
        console.warn(
          `[LLM Orchestrator] Attempting automatic failover to: ${nextAttempt.modelName} using ${nextAttempt.keyType} key...`
        );
        continue;
      }
    }
  }

  // If all attempts failed, throw the last error
  throw lastError;
}

