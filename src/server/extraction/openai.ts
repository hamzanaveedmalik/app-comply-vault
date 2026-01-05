import { OpenAI } from "openai";
import { env } from "~/env";
import type { ExtractionResult, ExtractedRecommendation, ExtractedDisclosure, ExtractedDecision, ExtractedFollowUp } from "./types";

/**
 * OpenAI implementation of LLM extraction provider
 */
export class OpenAIExtractionProvider {
  private client: OpenAI;

  constructor() {
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required for OpenAI extraction");
    }
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  /**
   * Extract structured fields from transcript using OpenAI
   */
  async extract(transcriptText: string, transcriptSegments: Array<{ startTime: number; endTime: number; text: string }>): Promise<ExtractionResult> {
    const startTime = Date.now();

    const systemPrompt = `You are a compliance assistant that extracts structured information from financial advisor meeting transcripts.

Extract the following information:
1. Topics: List of main topics discussed (as an array of strings)
2. Recommendations: Investment or financial recommendations made to the client (with timestamps)
3. Disclosures: Risk disclosures, conflicts of interest, or regulatory disclosures mentioned (with timestamps)
4. Decisions: Client decisions or agreements made during the meeting (with timestamps)
5. Follow-ups: Action items or follow-up tasks mentioned (with timestamps)

For each recommendation, disclosure, decision, and follow-up, you must:
- Provide the exact text of what was said
- Include the startTime and endTime (in seconds) from the transcript
- Include a snippet (the relevant transcript text around that time)
- Assign a confidence score (0-1) indicating how certain you are about the extraction

Return your response as valid JSON matching this structure:
{
  "topics": ["topic1", "topic2"],
  "recommendations": [
    {
      "text": "I recommend...",
      "startTime": 45.2,
      "endTime": 52.8,
      "snippet": "relevant transcript text...",
      "confidence": 0.95
    }
  ],
  "disclosures": [...],
  "decisions": [...],
  "followUps": [...]
}`;

    const userPrompt = `Please extract compliance-relevant information from this meeting transcript:

${transcriptText}

Transcript segments with timestamps:
${transcriptSegments.map(s => `[${s.startTime}s-${s.endTime}s] ${s.text}`).join("\n")}

Return the extraction as JSON.`;

    try {
      const response = await this.client.chat.completions.create({
        model: env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3, // Lower temperature for more consistent extraction
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("OpenAI returned empty response");
      }

      const parsed = JSON.parse(content);

      // Validate and normalize the response
      const result: ExtractionResult = {
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
        recommendations: this.normalizeExtractedItems(parsed.recommendations || [], "recommendation"),
        disclosures: this.normalizeExtractedItems(parsed.disclosures || [], "disclosure"),
        decisions: this.normalizeExtractedItems(parsed.decisions || [], "decision"),
        followUps: this.normalizeExtractedItems(parsed.followUps || [], "followUp"),
        provider: "openai",
        processingTime: Date.now() - startTime,
      };

      return result;
    } catch (error) {
      console.error("OpenAI extraction error:", error);
      throw new Error(`OpenAI extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Normalize extracted items to ensure they have required fields
   */
  private normalizeExtractedItems(
    items: any[],
    type: "recommendation" | "disclosure" | "decision" | "followUp"
  ): ExtractedRecommendation[] | ExtractedDisclosure[] | ExtractedDecision[] | ExtractedFollowUp[] {
    return items.map((item) => ({
      text: item.text || "",
      startTime: typeof item.startTime === "number" ? item.startTime : 0,
      endTime: typeof item.endTime === "number" ? item.endTime : 0,
      snippet: item.snippet || item.text || "",
      confidence: typeof item.confidence === "number" ? Math.max(0, Math.min(1, item.confidence)) : 0.8, // Default 0.8 if not provided
    }));
  }
}

