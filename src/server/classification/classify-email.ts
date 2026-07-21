/**
 * Email classification LLM call — reuses extraction provider env + redaction guard.
 */

import { OpenAI } from "openai";
import { env } from "~/env";
import {
  assertRedactionGuardUsed,
  callLlmWithRedaction,
} from "./redaction-guard";
import {
  EMAIL_CLASSIFICATION_PROMPT_VERSION,
  EMAIL_TAXONOMY_SYSTEM_PROMPT,
  emailClassificationLlmSchema,
  type EmailClassificationLlmResult,
} from "./email-taxonomy";

export type ClassifyEmailLlmArgs = {
  bodyText: string;
  fromAddress: string;
  toAddresses: string[];
};

export type ClassifyEmailLlmOutcome = {
  parsed: EmailClassificationLlmResult;
  modelId: string;
  promptVersion: string;
  contentHash: string;
};

function getModelId(): string {
  return env.OPENAI_MODEL || "gpt-4o-mini";
}

async function invokeOpenAiJson(redactedText: string): Promise<EmailClassificationLlmResult> {
  assertRedactionGuardUsed();
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for email classification");
  }
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: getModelId(),
    messages: [
      { role: "system", content: EMAIL_TAXONOMY_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Classify this redacted email body:\n\n${redactedText}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty classification response");
  const json: unknown = JSON.parse(content);
  return emailClassificationLlmSchema.parse(json);
}

/**
 * Classify email body via redaction guard + OpenAI (same stack as meeting extraction).
 * Retries once on parse/provider failure, then throws (caller dead-letters).
 */
export async function classifyEmailWithLlm(
  args: ClassifyEmailLlmArgs
): Promise<ClassifyEmailLlmOutcome> {
  const { redactForLlm } = await import("./redaction-guard");
  const redacted = redactForLlm({
    bodyText: args.bodyText,
    fromAddress: args.fromAddress,
    toAddresses: args.toAddresses,
  });

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = await callLlmWithRedaction({
        bodyText: args.bodyText,
        fromAddress: args.fromAddress,
        toAddresses: args.toAddresses,
        invoke: invokeOpenAiJson,
      });
      return {
        parsed,
        modelId: getModelId(),
        promptVersion: EMAIL_CLASSIFICATION_PROMPT_VERSION,
        contentHash: redacted.contentHash,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
  throw lastError ?? new Error("Email classification failed");
}
