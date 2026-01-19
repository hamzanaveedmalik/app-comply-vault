import { env } from "~/env";
import { OpenAIExtractionProvider } from "./openai";
import { AnthropicExtractionProvider } from "./anthropic";
import { VertexAIExtractionProvider } from "./vertex";
import type { ExtractionResult } from "./types";
import type { Transcript } from "../transcription/types";

/**
 * Extraction provider interface
 */
interface ExtractionProvider {
  extract(transcriptText: string, transcriptSegments: Array<{ startTime: number; endTime: number; text: string }>): Promise<ExtractionResult>;
}

/**
 * Get the configured extraction provider
 */
function getExtractionProvider(): ExtractionProvider {
  const provider = env.EXTRACTION_PROVIDER || "openai";

  if (provider === "openai") {
    return new OpenAIExtractionProvider();
  } else if (provider === "anthropic") {
    return new AnthropicExtractionProvider();
  } else if (provider === "vertex") {
    return new VertexAIExtractionProvider({
      apiEndpoint: env.VERTEX_API_ENDPOINT || "us-central1-aiplatform.googleapis.com",
      projectId: env.VERTEX_PROJECT_ID || "",
      location: env.VERTEX_LOCATION || "us-central1",
      modelId: env.VERTEX_MODEL_ID || "text-bison",
    });
  } else {
    throw new Error(`Unsupported extraction provider: ${provider}. Supported: openai, anthropic, vertex`);
  }
}

/**
 * Extract structured fields from transcript with retry logic
 * Implements exponential backoff (max 3 retries) per NFR66
 */
export async function extractFields(
  transcript: Transcript,
  options?: {
    maxRetries?: number;
    initialDelay?: number;
  }
): Promise<ExtractionResult> {
  const maxRetries = options?.maxRetries ?? 3;
  const initialDelay = options?.initialDelay ?? 1000; // 1 second

  // Convert transcript to text and segments
  const transcriptText = transcript.segments.map((s) => s.text).join(" ");
  const transcriptSegments = transcript.segments.map((s) => ({
    startTime: s.startTime,
    endTime: s.endTime,
    text: s.text,
  }));

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const provider = getExtractionProvider();
      const result = await provider.extract(transcriptText, transcriptSegments);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        // Exponential backoff: delay = initialDelay * 2^attempt
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`Extraction attempt ${attempt + 1} failed, retrying in ${delay}ms...`, lastError.message);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(`Extraction failed after ${maxRetries + 1} attempts:`, lastError);
        throw new Error(`Extraction failed after ${maxRetries + 1} attempts: ${lastError.message}`);
      }
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error("Extraction failed");
}

