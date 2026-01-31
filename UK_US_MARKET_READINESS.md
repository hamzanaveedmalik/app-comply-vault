# UK/US Market Readiness Plan

This document outlines all changes required to make Comply Vault ready for both US and UK markets.

## Current State

### ✅ Already Implemented
- **Billing Currency Support**: USD and GBP currencies are supported in the codebase
- **Multi-tenant Architecture**: Workspace isolation is already in place
- **Audit Logging**: Comprehensive audit trail system exists
- **Export Functionality**: PDF, CSV, TXT, ZIP export formats available
- **Compliance Flags**: System for flagging compliance issues exists

### ❌ Missing for UK Market
- **Regulatory Jurisdiction Selection**: No way to specify SEC vs FCA
- **UK-Specific Compliance Rules**: All rules are SEC-focused
- **UK Data Retention Requirements**: Currently hardcoded to SEC 5-year minimum
- **FCA Compliance Features**: No FCA-specific flags or checks
- **UK Privacy Regulations**: GDPR/UK GDPR compliance not addressed
- **UK-Specific Export Formats**: Exports are SEC-focused
- **Documentation**: All docs reference US market only

---

## Required Changes

### 1. Database Schema Changes

#### 1.1 Add Regulatory Jurisdiction to Workspace
**File**: `prisma/schema.prisma`

```prisma
enum RegulatoryJurisdiction {
  SEC_US    // US Securities and Exchange Commission
  FCA_UK    // UK Financial Conduct Authority
}

model Workspace {
  // ... existing fields ...
  regulatoryJurisdiction RegulatoryJurisdiction @default(SEC_US)
  // ... rest of fields ...
}
```

**Migration Required**: Create migration to add `regulatoryJurisdiction` field with default `SEC_US` for existing workspaces.

#### 1.2 Update Retention Years Logic
**File**: `prisma/schema.prisma`

Currently: `retentionYears Int @default(6) // Minimum 5, default 6 (SEC requirement + buffer)`

**Change**: Make retention jurisdiction-aware:
- **SEC (US)**: Minimum 5 years, default 6 years
- **FCA (UK)**: Minimum 7 years (per FCA record-keeping requirements), default 7 years

**Implementation**: Add validation based on `regulatoryJurisdiction` when workspace is created/updated.

---

### 2. Compliance Flags & Rules

#### 2.1 Add UK-Specific Flag Types
**File**: `prisma/schema.prisma`

Current `FlagType` enum:
```prisma
enum FlagType {
  MISSING_DISCLOSURE
  CONFLICT_LANGUAGE
  MISSING_SUITABILITY_BASIS
}
```

**Add UK-Specific Flags**:
```prisma
enum FlagType {
  // US (SEC) flags
  MISSING_DISCLOSURE
  CONFLICT_LANGUAGE
  MISSING_SUITABILITY_BASIS
  
  // UK (FCA) flags
  MISSING_COBS_DISCLOSURE        // COBS (Conduct of Business Sourcebook) disclosure
  MISSING_MIFID_DISCLOSURE        // MiFID II disclosure requirements
  MISSING_RISK_WARNING           // FCA risk warning requirements
  MISSING_COST_DISCLOSURE        // FCA cost disclosure requirements
  MISSING_APPROPRIATE_ADVICE     // FCA appropriate advice requirements
  CONFLICT_OF_INTEREST_FCA       // FCA conflict of interest rules
}
```

#### 2.2 Create Jurisdiction-Aware Flag Detection
**New File**: `src/server/compliance/flags.ts`

Create functions that:
- Detect compliance flags based on `workspace.regulatoryJurisdiction`
- Apply SEC rules for US workspaces
- Apply FCA rules for UK workspaces
- Support both jurisdictions in the same codebase

**Example Structure**:
```typescript
export function detectComplianceFlags(
  extraction: ExtractionData,
  jurisdiction: 'SEC_US' | 'FCA_UK'
): Flag[] {
  if (jurisdiction === 'SEC_US') {
    return detectSECFlags(extraction);
  } else {
    return detectFCAFlags(extraction);
  }
}
```

---

### 3. Workspace Creation & UI

#### 3.1 Add Jurisdiction Selection to Workspace Creation
**File**: `src/app/api/workspaces/route.ts`

Update schema:
```typescript
const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  intent: z.enum(["trial", "solo", "team"]).optional(),
  currency: z.enum(["USD", "GBP"]).optional(),
  regulatoryJurisdiction: z.enum(["SEC_US", "FCA_UK"]).optional(), // NEW
  onboarding: z.enum(["none", "standard", "premium"]).optional(),
});
```

**Logic**:
- If `currency === "GBP"`, default `regulatoryJurisdiction` to `FCA_UK`
- If `currency === "USD"`, default `regulatoryJurisdiction` to `SEC_US`
- Allow manual override

#### 3.2 Update Workspace Creation UI
**File**: `src/app/(app)/workspaces/new/page.tsx` (or wherever workspace creation form is)

Add jurisdiction selector:
```tsx
<Select
  value={jurisdiction}
  onValueChange={setJurisdiction}
>
  <SelectTrigger>
    <SelectValue placeholder="Select regulatory jurisdiction" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="SEC_US">US (SEC)</SelectItem>
    <SelectItem value="FCA_UK">UK (FCA)</SelectItem>
  </SelectContent>
</Select>
```

**Auto-linking**:
- When user selects GBP currency → suggest FCA_UK
- When user selects USD currency → suggest SEC_US
- Show warning if currency/jurisdiction mismatch

#### 3.3 Update Welcome/Billing UI
**File**: `src/app/(app)/welcome/welcome-client.tsx`

Display jurisdiction information:
```tsx
<Badge variant="outline">
  {workspace.regulatoryJurisdiction === 'SEC_US' ? 'SEC (US)' : 'FCA (UK)'}
</Badge>
```

---

### 4. Data Retention Logic

#### 4.1 Update Retention Validation
**New File**: `src/server/compliance/retention.ts`

```typescript
export const RETENTION_REQUIREMENTS = {
  SEC_US: {
    minimum: 5,
    default: 6,
  },
  FCA_UK: {
    minimum: 7,
    default: 7,
  },
} as const;

export function validateRetentionYears(
  years: number,
  jurisdiction: 'SEC_US' | 'FCA_UK'
): { valid: boolean; error?: string } {
  const requirement = RETENTION_REQUIREMENTS[jurisdiction];
  if (years < requirement.minimum) {
    return {
      valid: false,
      error: `${jurisdiction === 'SEC_US' ? 'SEC' : 'FCA'} requires minimum ${requirement.minimum} years retention`,
    };
  }
  return { valid: true };
}
```

#### 4.2 Update Workspace Creation
**File**: `src/app/api/workspaces/route.ts`

```typescript
const jurisdiction = regulatoryJurisdiction ?? (currency === 'GBP' ? 'FCA_UK' : 'SEC_US');
const retentionConfig = RETENTION_REQUIREMENTS[jurisdiction];

const workspace = await db.workspace.create({
  data: {
    // ... other fields ...
    regulatoryJurisdiction: jurisdiction,
    retentionYears: retentionConfig.default,
  },
});
```

---

### 5. Export Formats

#### 5.1 UK-Specific Export Templates
**File**: `src/server/export/pdf.ts`

Add jurisdiction-aware PDF generation:
```typescript
export async function generateComplianceNotePDF({
  meeting,
  extraction,
  workspaceName,
  workspaceJurisdiction, // NEW
  watermarked = false,
}: GeneratePDFOptions): Promise<Buffer> {
  // ... existing code ...
  
  // Add jurisdiction-specific header
  if (workspaceJurisdiction === 'FCA_UK') {
    doc.text("FCA Compliance Record", pageWidth / 2, yPos, { align: "center" });
    doc.text("Conduct of Business Sourcebook (COBS) Compliance", margin, yPos);
  } else {
    doc.text("SEC Rule 204-2 Compliance Record", pageWidth / 2, yPos, { align: "center" });
  }
  
  // ... rest of PDF generation ...
}
```

#### 5.2 Update Export API
**File**: `src/app/api/meetings/[id]/export/route.ts`

Pass jurisdiction to export functions:
```typescript
const zipBuffer = await generateAuditPack({
  meeting: meetingForExport,
  extraction,
  transcript,
  versions,
  workspace,
  jurisdiction: workspace.regulatoryJurisdiction, // NEW
  watermarked,
});
```

---

### 6. Compliance Validation

#### 6.1 Create FCA Compliance Rules
**New File**: `src/server/compliance/fca-rules.ts`

```typescript
import type { ExtractionData } from '../extraction/types';

export interface FCAFlag {
  type: 'MISSING_COBS_DISCLOSURE' | 'MISSING_MIFID_DISCLOSURE' | /* ... */;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  evidence: string;
  timestamp: number;
}

export function detectFCAFlags(extraction: ExtractionData): FCAFlag[] {
  const flags: FCAFlag[] = [];
  
  // Check for COBS disclosure requirements
  if (!hasCOBSDisclosure(extraction)) {
    flags.push({
      type: 'MISSING_COBS_DISCLOSURE',
      severity: 'CRITICAL',
      evidence: 'No COBS disclosure found in meeting',
      timestamp: 0,
    });
  }
  
  // Check for MiFID II requirements
  if (!hasMIFIDDisclosure(extraction)) {
    flags.push({
      type: 'MISSING_MIFID_DISCLOSURE',
      severity: 'WARN',
      evidence: 'No MiFID II disclosure found',
      timestamp: 0,
    });
  }
  
  // ... more FCA-specific checks ...
  
  return flags;
}
```

#### 6.2 Update Flag Detection in Processing
**File**: `src/app/api/jobs/process-meeting/route.ts`

Update flag detection to be jurisdiction-aware:
```typescript
// Get workspace jurisdiction
const workspace = await db.workspace.findUnique({
  where: { id: meeting.workspaceId },
  select: { regulatoryJurisdiction: true },
});

// Detect flags based on jurisdiction
const flags = workspace.regulatoryJurisdiction === 'FCA_UK'
  ? detectFCAFlags(extraction)
  : detectSECFlags(extraction);

// Create flags in database
for (const flag of flags) {
  await db.flag.create({
    data: {
      workspaceId: meeting.workspaceId,
      meetingId: meeting.id,
      type: flag.type,
      severity: flag.severity,
      evidence: { text: flag.evidence, timestamp: flag.timestamp },
      createdByType: 'SYSTEM',
    },
  });
}
```

---

### 7. Privacy & Data Protection

#### 7.1 GDPR/UK GDPR Compliance
**File**: `SECURITY.md`

Add section:
```markdown
## UK Privacy Compliance

### GDPR/UK GDPR
- **Data Subject Rights**: Support for data access, rectification, erasure requests
- **Lawful Basis**: Record keeping for regulatory compliance (Article 6(1)(c))
- **Data Minimization**: Only collect necessary data for compliance records
- **Retention**: 7-year retention aligns with FCA requirements
- **Data Processing Agreements**: All subprocessors must comply with GDPR
- **Breach Notification**: 72-hour notification requirement for data breaches
```

#### 7.2 Add Data Subject Rights API
**New File**: `src/app/api/data-subject-rights/route.ts`

```typescript
// Support for GDPR Article 15 (Right of Access)
export async function GET(request: Request) {
  // Return all data for a user
}

// Support for GDPR Article 17 (Right to Erasure)
export async function DELETE(request: Request) {
  // Handle deletion requests (with legal hold checks)
}
```

---

### 8. Documentation Updates

#### 8.1 Update FAQ
**File**: `docs/FAQ.md`

Add UK section:
```markdown
### Is this available in the UK?

Yes! Comply Vault supports both US (SEC) and UK (FCA) regulatory requirements.

### What's the difference between US and UK versions?

- **US (SEC)**: Complies with SEC Rule 204-2, 5-year minimum retention
- **UK (FCA)**: Complies with FCA COBS and MiFID II requirements, 7-year minimum retention

You select your regulatory jurisdiction when creating your workspace.
```

#### 8.2 Update Security Documentation
**File**: `SECURITY.md`

Add FCA compliance section:
```markdown
## Compliance

### SEC Rule 204-2 Compliance (US)
- **Books & Records**: System generates exam-ready audit packs
- **Retention**: Enforces minimum 5-year retention (configurable)
- **Audit Trail**: Complete audit logging of all actions
- **Evidence Integrity**: Timestamp-linked evidence with transcript snippets

### FCA Compliance (UK)
- **COBS Compliance**: System checks for Conduct of Business Sourcebook requirements
- **MiFID II Compliance**: Validates MiFID II disclosure requirements
- **Retention**: Enforces minimum 7-year retention (FCA requirement)
- **Record Keeping**: Generates FCA-compliant audit packs
- **Audit Trail**: Complete audit logging meeting FCA standards
```

#### 8.3 Update User Guide
**File**: `docs/USER_GUIDE.md`

Add section on jurisdiction selection and UK-specific features.

---

### 9. Environment Variables

#### 9.1 No New Variables Required
The existing GBP pricing variables are sufficient. The jurisdiction is stored in the database, not environment variables.

---

### 10. Testing Requirements

#### 10.1 Test Cases Needed

1. **Workspace Creation**
   - Create workspace with SEC_US jurisdiction
   - Create workspace with FCA_UK jurisdiction
   - Verify retention years are set correctly
   - Verify currency/jurisdiction auto-linking

2. **Compliance Flags**
   - Verify SEC flags are detected for US workspaces
   - Verify FCA flags are detected for UK workspaces
   - Verify flags don't cross jurisdictions

3. **Exports**
   - Verify US exports have SEC-compliant format
   - Verify UK exports have FCA-compliant format
   - Verify retention requirements in exports

4. **Data Retention**
   - Verify 5-year minimum for SEC
   - Verify 7-year minimum for FCA
   - Verify validation prevents invalid retention periods

---

## Implementation Priority

### Phase 1: Core Infrastructure (Week 1-2)
1. ✅ Add `regulatoryJurisdiction` to Workspace model
2. ✅ Create migration
3. ✅ Update workspace creation API
4. ✅ Add jurisdiction selection UI

### Phase 2: Compliance Rules (Week 2-3)
1. ✅ Add FCA flag types to schema
2. ✅ Create FCA compliance detection logic
3. ✅ Update flag detection in processing pipeline
4. ✅ Add jurisdiction-aware retention validation

### Phase 3: Export & Documentation (Week 3-4)
1. ✅ Update export formats for UK
2. ✅ Update all documentation
3. ✅ Add GDPR compliance features
4. ✅ Update security documentation

### Phase 4: Testing & Polish (Week 4)
1. ✅ Comprehensive testing
2. ✅ UI/UX improvements
3. ✅ Documentation review
4. ✅ Legal review (if needed)

---

## Migration Strategy

### For Existing Workspaces
1. All existing workspaces default to `SEC_US` jurisdiction
2. Workspace owners can update jurisdiction in settings (with validation)
3. Changing jurisdiction requires:
   - Confirmation dialog
   - Retention period validation
   - Warning about compliance rule changes

### For New Workspaces
1. Default to `SEC_US` if currency is USD
2. Default to `FCA_UK` if currency is GBP
3. Allow manual override with clear explanation

---

## Legal & Compliance Considerations

### US (SEC)
- ✅ SEC Rule 204-2 compliance already implemented
- ✅ 5-year retention requirement met
- ✅ GLBA compliance addressed

### UK (FCA)
- ⚠️ **Requires Legal Review**: FCA COBS and MiFID II requirements need legal validation
- ⚠️ **7-Year Retention**: Must be enforced (different from SEC)
- ⚠️ **GDPR Compliance**: Must ensure all data processing meets GDPR requirements
- ⚠️ **Data Processing Agreements**: All UK customer data must be processed under GDPR-compliant agreements

### Recommendations
1. **Legal Review**: Engage UK financial services lawyer to validate FCA compliance
2. **GDPR Audit**: Conduct GDPR compliance audit for UK data processing
3. **Terms of Service**: Update ToS to include UK-specific terms
4. **Privacy Policy**: Update privacy policy for GDPR/UK GDPR compliance

---

## Estimated Effort

- **Database Changes**: 2-4 hours
- **Compliance Logic**: 16-24 hours
- **UI Updates**: 8-12 hours
- **Export Updates**: 8-12 hours
- **Documentation**: 8-12 hours
- **Testing**: 16-24 hours
- **Legal Review**: External (timeline TBD)

**Total Development Time**: ~70-90 hours (2-3 weeks for one developer)

---

## Success Criteria

✅ **US Market Ready**
- All existing SEC compliance features work
- No regression in US functionality

✅ **UK Market Ready**
- FCA compliance rules implemented
- 7-year retention enforced
- UK-specific exports available
- GDPR compliance addressed
- Documentation updated
- Legal review completed

---

## Notes

- **Currency vs Jurisdiction**: While GBP often indicates UK, allow manual override for edge cases (e.g., UK firm using USD, US firm using GBP)
- **Future Jurisdictions**: Schema designed to support additional jurisdictions (e.g., ASIC for Australia, ESMA for EU)
- **Compliance Updates**: Regulatory requirements change; system should be designed to update rules without code changes where possible
