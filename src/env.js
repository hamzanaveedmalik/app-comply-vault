import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    // All server env vars are optional for build-time validation
    // Runtime checks are performed where these values are actually used
    AUTH_SECRET: z.string().optional(),
    AUTH_URL: z.string().url().optional(), // Base URL for NextAuth (e.g., https://app-staging.complyvault.co)
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
    DATABASE_URL: z.string().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    S3_BUCKET_NAME: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ENDPOINT: z.string().optional(), // For R2 or other S3-compatible storage
    QSTASH_TOKEN: z.string().optional(), // Upstash QStash token
    QSTASH_CURRENT_SIGNING_KEY: z.string().optional(), // QStash webhook signature verification
    QSTASH_NEXT_SIGNING_KEY: z.string().optional(), // QStash webhook signature verification (for key rotation)
      // Transcription providers
      TRANSCRIPTION_PROVIDER: z.enum(["deepgram", "assemblyai"]).optional().default("deepgram"),
      DEEPGRAM_API_KEY: z.string().optional(),
      ASSEMBLYAI_API_KEY: z.string().optional(),
      // Extraction providers
      EXTRACTION_PROVIDER: z.enum(["openai", "anthropic"]).optional().default("openai"),
      OPENAI_API_KEY: z.string().optional(),
      OPENAI_MODEL: z.string().optional().default("gpt-4o-mini"),
      ANTHROPIC_API_KEY: z.string().optional(),
      ANTHROPIC_MODEL: z.string().optional().default("claude-3-5-sonnet-20241022"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_APP_URL: z.string().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_REGION: process.env.S3_REGION,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    QSTASH_TOKEN: process.env.QSTASH_TOKEN,
    QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
    QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
      TRANSCRIPTION_PROVIDER: process.env.TRANSCRIPTION_PROVIDER,
      DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
      ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY,
      EXTRACTION_PROVIDER: process.env.EXTRACTION_PROVIDER,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
