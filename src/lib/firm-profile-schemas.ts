import { z } from "zod";

const requiredTrimmedString = z
  .string()
  .trim()
  .min(1, "This field is required.");

export const firmProfileStep1Schema = z.object({
  crdNumber: requiredTrimmedString,
  ccoName: requiredTrimmedString,
  advFilingDate: z.string().datetime().optional().nullable(),
  aumUsd: z.union([z.string(), z.number()]).optional().nullable(),
  advDocumentUrl: z.string().url().optional().nullable().or(z.literal("")),
  riskFlags: z.array(z.string()).optional(),
});

export const createDraftSchema = firmProfileStep1Schema.extend({
  status: z.literal("DRAFT").optional(),
});

export const patchProfileSchema = z.object({
  crdNumber: z.string().optional(),
  ccoName: z.string().optional(),
  advFilingDate: z.string().datetime().optional().nullable(),
  aumUsd: z.union([z.string(), z.number()]).optional().nullable(),
  advDocumentUrl: z.string().url().optional().nullable().or(z.literal("")),
  riskFlags: z.array(z.string()).optional(),
});

export type FirmProfileStep1Input = z.infer<typeof firmProfileStep1Schema>;

export type Step1FieldErrors = Partial<Record<"crdNumber" | "ccoName", string>>;

export type Step1SoftWarnings = Partial<Record<"advFilingDate" | "aumUsd", string>>;

export function validateStep1Client(values: {
  crdNumber: string;
  ccoName: string;
  advFilingDate: string;
  aumUsd: string;
}): { errors: Step1FieldErrors; warnings: Step1SoftWarnings; canContinue: boolean } {
  const errors: Step1FieldErrors = {};
  const warnings: Step1SoftWarnings = {};

  if (!values.crdNumber.trim()) {
    errors.crdNumber = "CRD number is required to anchor disclosure flags to your firm.";
  }
  if (!values.ccoName.trim()) {
    errors.ccoName = "CCO name is required for audit trail accountability.";
  }
  if (!values.advFilingDate.trim()) {
    warnings.advFilingDate =
      "ADV filing date helps anchor disclosure timing in audit packs.";
  }
  if (!values.aumUsd.trim()) {
    warnings.aumUsd = "AUM is recommended for firm risk context.";
  }

  return {
    errors,
    warnings,
    canContinue: Object.keys(errors).length === 0,
  };
}

export function hasRequiredFirmIdentity(profile: {
  crdNumber: string | null;
  ccoName: string | null;
}): boolean {
  return Boolean(profile.crdNumber?.trim() && profile.ccoName?.trim());
}
