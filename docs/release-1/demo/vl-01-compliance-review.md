---
tags:
  - release-1
  - demo
  - compliance
---

# CV-VL-01 — Compliance review (candidate pack language)

**Reviewed:** 2026-08-08  
**Reviewer:** Engineering compliance pass (code + copy). Former-examiner confirmation (Janice Powell / Miles Edwards) remains desirable before pilot, not blocking demo language after the remediations below.

## Scope reviewed

1. Interpreted-scope confirmation copy (`candidate-pack-client.tsx`)
2. Coverage statement statuses and user-facing labels (`candidate-pack/types.ts`)
3. Manual-confirmation / approval attestation language
4. Exam-ready / “responsive” claim guards (`assertNoExamReadyClaim`, Release 1 contracts)

## Findings and remediations

| Surface | Risk | Disposition |
|---|---|---|
| Label **“Answerable”** | Reads as “this exam item is answered / the firm can respond” | **Fixed** → **“Matches under scope”** |
| Label **“Partially answerable”** | Same completeness implication | **Fixed** → **“Partial matches — gaps remain”** |
| Detail strings (“Found N candidate … under the confirmed scope”) | Acceptable — candidate + confirmed scope named | Keep |
| Manual confirmation row | Correctly requires human review before examination use | Keep |
| Scope confirmation gate | Nothing generates before confirm — required | Keep |
| “Approved for export use” | OK only with candidate framing elsewhere on screen | Keep; attestation dialog still required |
| Word “responsive” | Forbidden in XR | Absent from pack code paths (guarded by contracts) |
| “Exam ready” | Forbidden in pack copy | Guarded by `assertNoExamReadyClaim` |

## Verdict for 10 Aug demo

Ship with remediated labels. Spoken line if challenged:

> These statuses describe whether matches exist under the scope you confirmed — not whether the firm has answered an examiner.

## Former-examiner follow-up (optional, post-demo)

Ask Janice or Miles to confirm the remediated pair (“Matches under scope” / “Partial matches — gaps remain”) still survives contact with current exam-letter practice.
