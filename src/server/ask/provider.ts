/**
 * Ask ComplyVault — LLM provider abstraction.
 *
 * Reuses the same providers as src/server/extraction/ so we don't re-tread
 * the credentials/config story. Phase 1 ships with OpenAI as the default;
 * Anthropic and Vertex are wired through the same `EXTRACTION_PROVIDER`
 * env switch so a workspace-level override (Phase 2) drops in cleanly.
 *
 * Retry policy: 2 attempts max (lower than extraction's 3 — Ask is
 * interactive, not batch). Exponential backoff on transient failures.
 */

import { OpenAI } from "openai";
import { env } from "~/env";

export type AskCompletionInput = {
  systemPrompt: string;
  userMessage: string;
  model: string;
};

export type AskCompletionFn = (input: AskCompletionInput) => Promise<string>;

/**
 * Returns the model identifier that will be used for the active provider.
 * Used in the audit log and response payload so operators can reproduce
 * a question against the same model later.
 */
export function resolveAskModel(): string {
  const provider = env.EXTRACTION_PROVIDER || "openai";
  switch (provider) {
    case "openai":
      return env.OPENAI_MODEL || "gpt-4o-mini";
    case "anthropic":
      return env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";
    case "vertex":
      return env.VERTEX_MODEL_ID || "text-bison";
    default:
      return "gpt-4o-mini";
  }
}

function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; code?: string };
  if (typeof e.status === "number" && e.status >= 500) return true;
  if (e.status === 429) return true;
  if (e.code === "ETIMEDOUT" || e.code === "ECONNRESET") return true;
  return false;
}

let _openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (_openaiClient) return _openaiClient;
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for Ask ComplyVault");
  }
  _openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return _openaiClient;
}

/**
 * Default completion implementation. Phase 1 only wires OpenAI — the
 * provider switch is left in place so Phase 2 can extend it without
 * touching the orchestrator.
 */
export const defaultAskCompletion: AskCompletionFn = async ({
  systemPrompt,
  userMessage,
  model,
}) => {
  const provider = env.EXTRACTION_PROVIDER || "openai";

  if (provider !== "openai") {
    // Anthropic / Vertex are out of scope for Phase 1 — surface a clear
    // error rather than silently falling back, so a misconfigured
    // workspace doesn't end up answering with the wrong model.
    throw new Error(
      `Ask ComplyVault Phase 1 only supports OPENAI extraction provider (current: ${provider}). ` +
        "Configure EXTRACTION_PROVIDER=openai or wait for Phase 2."
    );
  }

  const client = getOpenAIClient();
  const maxAttempts = 2;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
        max_tokens: 400,
      });
      const content = response.choices[0]?.message?.content;
      if (!content || !content.trim()) {
        throw new Error("LLM returned empty response");
      }
      return content.trim();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1 && isTransientError(err)) {
        // Backoff: 500ms, then 1500ms.
        const delay = 500 * Math.pow(3, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      break;
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`LLM provider error: ${message}`);
};
