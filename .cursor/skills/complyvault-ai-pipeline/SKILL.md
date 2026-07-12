---
name: complyvault-ai-pipeline
description: Standards for ComplyVault's AI classification pipeline — two-stage triage, LLM calls, redaction guard, prompt logging, risk scoring, eval tracking. Use when implementing stories CV-C-01..10, CV-B-09, CV-D-02/03, CV-E-04, or any code that sends content to an LLM provider.
---

# ComplyVault AI Pipeline

Core principle: **route attention, not retention**. AI classifies, flags, explains and routes. It never suppresses, deletes or hides documentation, and never makes final compliance decisions.

## Two-stage pipeline (CV-C-01/02)

1. **Stage 1 — heuristic pre-filter**: cheap keyword/regex rules per taxonomy category (advice, performance claims, fees, complaint, vulnerability, off-channel, marketing, service evidence). Selects candidates **plus a configurable random sample of non-candidates** (false-negative measurement, reused by the risk-based review programme CV-C-09). Build sampling as a shared service.
2. **Stage 2 — LLM classification**: runs only on items in scope per the firm's Documentation Scope Policy (CV-A-10). Out-of-scope items record the skip decision + policy version, not a classification.

## Every LLM call, no exceptions

- Goes through the **redaction guard** (CV-B-09) — a single choke-point module. No raw ingested content reaches a provider any other way; a unit test must prove the bypass is impossible.
- PII-minimising prompt construction: strip/placeholder client names, account numbers, dollar amounts where the classification doesn't need them.
- Log the full prompt/response pair (post-redaction) with `modelId` and `promptVersion` — this log is itself AI-governance evidence.
- Track token cost; classification cost per 1k emails is a tracked metric.
- Providers available in the codebase: `@anthropic-ai/sdk` and `openai`. Model + prompt version are data (`AIClassification.modelId` / `promptVersion`), never hardcoded display strings.

## Output contract

`AIClassification`: `category`, `riskScore` (0–100 int), `confidence` (0–1 float), `rationale` (plain English, one paragraph, references the actual message content), `modelId`, `promptVersion`. Validate LLM output with a Zod schema; on parse failure, retry once then dead-letter — never store malformed classifications.

## Language discipline

Outputs are **triage signals** (workflow metadata). In schema comments, variable names, and UI strings: "signal", never "finding"/"violation". A compliance record exists only when a human opens a ReviewCase or Finding.

## Retention & immutability

- Signals are append-only; re-classification appends a new row, never overwrites.
- Below-threshold signals are non-determinations on a shorter workflow-retention tier (CV-C-05) — do not implement tier-expiry behaviour without user confirmation that legal review happened.
- Human outcomes write back to `AIClassification.humanOutcome` and feed the eval set (CV-C-07): precision/recall per category, false-negative estimate from the stage-1 random sample.

## Prompts

Keep prompts in version-controlled files (e.g. `src/server/classification/prompts/`), one per task, with a version string bumped on any change. Rationale prompts must instruct the model to explain in plain English *why* the signal fired, quoting the trigger phrase.
