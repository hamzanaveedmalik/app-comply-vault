---
tags:
  - product
  - backlog
  - supervision
  - release-1-1
---

# ComplyVault Supervision Intelligence - R1.1 Backlog

**Release:** R1.1
**Target:** AdvizorStack demonstration and production release
**Release thesis:** Selectivity -> policy-centred findings -> supervisory action -> remediation -> partner command layer
**Priority rule:** All stories marked P0 form the critical release path.

## Purpose

This backlog defines the Supervision Intelligence release for ComplyVault. The release must prove that ComplyVault can process high-volume adviser communications, clear or sample routine activity, route a deliberately small set of policy-grounded findings for human review, support supervisory decisions and remediation, and surface repeated control weaknesses across firms.

## Conventions

- Story IDs: `CV-SI-<n>` (for example `CV-SI-001`)
- Sizing: S, M, L
- Priority: P0 (critical release path), P1 (important but not on the critical path)
- Human-review boundary: the product must never claim that ComplyVault independently determined a violation
- Compliance defaults: outcome changes, decisions, remediation state changes, exports, and permission failures must be audit-logged; soft delete only; no PII in logs

## Release definition of done

The release is complete when the following journey works end to end:

1. The Command Centre displays 147 processed interactions.
2. It shows 139 cleared, 5 sampled, and 3 escalated.
3. The user opens the CCO Priority Inbox.
4. The user opens the rollover and insurance finding.
5. The finding displays meeting and email evidence.
6. The finding displays the applicable policy and version.
7. The reasoning chain explains why human review is required.
8. The CCO selects Remediate.
9. A remediation task is created.
10. The decision appears in the append-only supervisory trail.
11. The partner control view shows the repeated rollover pattern.
12. The user drills from the pattern to the firm, adviser, and finding.
13. The completed supervisory record can be exported.
14. All actions respect tenant and role permissions.
15. No screen claims that ComplyVault independently determined a violation.

The release must truthfully prove:

> ComplyVault processes high-volume adviser communications, clears or samples routine activity, routes a limited number of policy-grounded findings for human review, enables the CCO to close the supervisory loop, and reveals repeated control weaknesses across firms.

---

## Epic 1 - Supervisory Outcome and Selectivity

### CV-SI-001 · Add supervisory outcomes to interactions - P0 - M ✅ done (2026-08-04)

As a Chief Compliance Officer, I want every processed interaction to receive a clear supervisory outcome so that I can understand what was cleared, sampled, escalated, or held.

**Outcomes**

- Cleared
- Routine sample
- Escalated
- Held
- Parked

**Requirements**

Add the following fields to the interaction model:

- `supervisoryOutcome`
- `outcomeReason`
- `outcomeConfidence`
- `processedAt`
- `primaryControlId`
- `heldReason`
- `parkedReason`

**Acceptance criteria**

- Every successfully processed interaction has exactly one supervisory outcome.
- An interaction cannot be both cleared and escalated.
- An interaction with a processing failure is assigned `Held`.
- An interaction without an active policy mapping cannot be assigned `Cleared`.
- Parked interactions require a recorded reason.
- Outcome changes generate an audit event.
- Existing Release 1 interactions remain readable after migration.
- Filters can query interactions by supervisory outcome.

### CV-SI-002 · Calculate cleared, sampled, escalated, and held counts - P0 - M ✅ done (2026-08-04)

**Depends on:** `CV-SI-001`

As a compliance executive, I want to see how many interactions were processed and how few required escalation so that I can assess the selectivity of ComplyVault.

**Requirements**

Create aggregation logic for:

- Total interactions processed
- Cleared or deprioritised
- Routine samples
- Priority findings
- Held interactions
- Open remediation

Support filters for:

- Date range
- Firm
- Adviser
- Channel
- Control
- Outcome

**Acceptance criteria**

- Counts reconcile with underlying interaction records.
- The total processed count equals the sum of all relevant outcomes.
- Changing filters updates all counts.
- Priority findings count includes only open or actionable escalated findings.
- Closed findings are not included in the active Priority Inbox count.
- Held items are counted separately from cleared items.
- Aggregation endpoints enforce tenant permissions.
- Seeded demo data returns 147 processed, 139 cleared, 5 sampled, 3 escalated, and 0 held.

### CV-SI-003 · Implement routine supervisory sampling - P1 - M ✅ done (2026-08-04)

**Depends on:** `CV-SI-001`

As a CCO, I want some non-escalated interactions selected for routine sampling so that I can test whether supervision controls are missing material concerns.

**Requirements**

Support sampling based on:

- Random percentage
- Adviser risk
- New adviser status
- Time since last review
- Control-specific policy
- Manual selection

**Acceptance criteria**

- Sampling does not automatically create a priority finding.
- Sampled interactions are distinguishable from escalated interactions.
- A sampled interaction may be manually escalated.
- The sampling reason is stored.
- Manual escalation generates a finding and audit event.
- Sampling configuration is tenant-specific.

---

## Epic 2 - AdvizorStack Command Centre

### CV-SI-004 · Build the Supervision Command Centre - P0 - L ✅ done (2026-08-04)

**Depends on:** `CV-SI-002`

As an AdvizorStack compliance executive, I want a portfolio-level supervision summary so that I can immediately see where compliance attention is required across firms.

**Page:** `/supervision`

**Required components**

Summary metrics:

- Interactions processed
- Cleared or deprioritised
- Routine samples
- Priority findings
- Held interactions
- Open remediation

Selectivity statement:

> 3 findings require review from 147 processed interactions.

Firm supervision table columns:

- Firm
- Processed interactions
- Priority findings
- Open remediation
- Oldest unresolved finding
- Top control concern
- Trend
- Coverage status

Emerging patterns:

- Display up to three material portfolio patterns

**Acceptance criteria**

- The page loads portfolio metrics for authorised firms.
- The selectivity ratio is visible without scrolling.
- Clicking Priority findings opens the filtered CCO Priority Inbox.
- Clicking a firm opens its supervision view.
- Clicking a control pattern opens supporting findings.
- Partner-level aggregates do not expose unauthorised client information.
- Loading, empty, and error states are implemented.
- The seeded tenant shows three firms.
- Metrics update when the date or firm filter changes.
- The page is responsive and keyboard accessible.

### CV-SI-005 · Add global supervision filters - P0 - S ✅ done (2026-08-08)

**Depends on:** `CV-SI-004`

As a compliance executive, I want to filter the Command Centre so that I can investigate specific firms, advisers, channels, and control areas.

**Filters**

- Date range
- Firm
- Adviser
- Channel
- Control
- Outcome
- Severity
- Finding status

**Acceptance criteria**

- Filter state is reflected in the URL.
- Filters persist when navigating back from a finding.
- Metrics, firm rows, and patterns use the same filter set.
- Clearing filters restores the default 30-day view.
- Users cannot filter into firms they are not permitted to access.

---

## Epic 3 - CCO Priority Inbox

### CV-SI-006 · Build the CCO Priority Inbox - P0 - L ✅ done (2026-08-08)

**Depends on:** `CV-SI-001`, `CV-SI-002`

As a CCO, I want a deliberately small and prioritised queue of supervisory findings so that I can focus only on interactions requiring human judgment.

**Page:** `/priority-inbox`

**Tabs**

- Unassigned
- Assigned to me
- In review
- Awaiting remediation
- Escalated
- Closed

**Finding row**

Each row must display:

- Finding title
- Firm
- Adviser
- Client or household
- Channels
- Primary control
- One-sentence escalation reason
- Severity
- Materiality
- Confidence
- Due date
- Owner
- Repeat indicator
- Evidence count
- Status

**Acceptance criteria**

- Only escalated findings appear in active Priority Inbox tabs.
- Cleared interactions do not appear.
- Routine samples do not appear unless manually escalated.
- Every finding has a primary control and policy mapping.
- Findings without policy mapping are assigned `Held`.
- The header shows priority findings count, total processed interactions, and the selectivity statement.
- Opening a finding preserves queue filters and scroll position.
- Queue counts reconcile with active filters.
- Empty states clearly explain that no findings require review.
- The page does not use the label `Needs Attention`.

### CV-SI-007 · Add Priority Inbox sorting and assignment - P0 - M

**Depends on:** `CV-SI-006`

As a compliance analyst, I want to sort and assign findings so that the most material items reach the appropriate reviewer.

**Default ordering**

1. Never-suppress controls
2. High client impact
3. High materiality
4. Overdue
5. Repeat adviser pattern
6. Multi-channel evidence
7. Confidence
8. Created date

**Actions**

- Assign owner
- Assign reviewer
- Change due date
- Mark in review
- Add internal note
- Bulk assign

**Acceptance criteria**

- The default ordering follows the defined priority rules.
- A user may sort by newest, oldest, due date, severity, firm, or adviser.
- Assignment changes generate audit events.
- Assignment changes are reflected without refreshing the page.
- Bulk assignment is limited to authorised roles.
- Decision actions are not available directly from the queue row.

---

## Epic 4 - Policy-Centred Supervisory Finding

### CV-SI-008 · Build the supervisory finding page - P0 - L

**Depends on:** `CV-SI-006`

As a CCO, I want one complete finding page containing evidence, context, policy, and actions so that I can reach a defensible decision without navigating across systems.

**Page:** `/findings/:findingId`

**Header fields**

- Finding ID
- Title
- Firm
- Adviser
- Client or household
- Status
- Severity
- Materiality
- Confidence
- Created date
- Review due date
- Owner
- Reviewer
- Repeat-pattern indicator

**Required sections**

- Observed conduct
- Why it may matter
- What was found
- What was not found
- Required human judgment
- Evidence
- Applicable policy
- Reasoning chain
- Relevant context
- Review notes
- Decision actions
- Supervisory trail

**Acceptance criteria**

- The full finding can be reviewed from one page.
- System-generated text is visually distinguishable from human-authored text.
- Every material assertion links to evidence, context, or policy.
- Missing evidence is not presented as proof that something did not occur.
- The page has a persistent human-review boundary statement.
- The page enforces tenant and object-level permissions.
- Opening the page creates an audit access event.
- Direct URLs cannot expose findings to unauthorised users.

### CV-SI-009 · Add the human-review boundary statement - P0 - S

**Depends on:** `CV-SI-008`

As a compliance reviewer, I want the system's limits stated clearly so that AI observations are not confused with final compliance conclusions.

**Required copy**

> ComplyVault has identified evidence requiring human supervisory review. It has not determined that a violation occurred.

**Acceptance criteria**

- The statement appears near the finding header.
- The statement appears before any decision controls.
- The statement is included in supervisory record exports.
- The UI does not use terms such as `AI violation`, `confirmed breach`, `automatically non-compliant`, or `AI verdict`.
- Cleared outcomes do not claim complete regulatory compliance.

### CV-SI-010 · Add multi-source evidence excerpts - P0 - L

**Depends on:** `CV-SI-008`

As a CCO, I want the exact relevant evidence from meetings, email, and other sources so that I can understand the finding without reviewing every full interaction.

**Supported sources**

- Meeting
- Email
- Message
- CRM note
- Uploaded document
- Archive record

**Evidence fields**

- Exact excerpt
- Speaker or sender
- Recipient
- Timestamp
- Source
- Source record ID
- Classification
- Confidence
- Link to surrounding context
- Integrity hash where available

**Evidence classifications**

- Supports finding
- Mitigates finding
- Context only
- Missing evidence
- Conflicting evidence

**Acceptance criteria**

- Evidence is grouped by source.
- Meeting and follow-up email evidence can appear in one finding.
- Each excerpt links to its surrounding source context.
- Supporting and mitigating evidence are visually distinguishable.
- Original source order is preserved.
- The system does not invent text when a source is unavailable.
- Evidence already supported by Release 1 components is reused.
- Reviewers can pin evidence to the final supervisory record.

### CV-SI-011 · Add full-context evidence viewer - P0 - M

**Depends on:** `CV-SI-010`

As a reviewer, I want to inspect the communication surrounding an evidence excerpt so that I do not make a decision based on an isolated sentence.

**Acceptance criteria**

- Selecting an excerpt opens the surrounding transcript, email thread, or document.
- The matched excerpt is highlighted.
- Preceding and following context is visible.
- Transcript content is labelled when machine-generated.
- Source timestamp and ingestion timestamp are shown.
- The user can return to the exact position in the finding.
- Source access is permission-controlled.
- Unavailable sources show a recoverable error state.

### CV-SI-012 · Add firm policy as a first-class finding section - P0 - L

**Depends on:** `CV-SI-008`

As a CCO, I want every finding connected to the firm's applicable policy so that the review is grounded in the firm's actual supervisory requirements.

**Policy fields**

- Policy name
- Control name
- Policy section
- Applicable text
- Version
- Effective date
- Policy owner
- Firm
- Mapping rationale
- Mapping confidence

**Acceptance criteria**

- Every Priority finding has one primary control.
- Every Priority finding has at least one applicable policy section.
- The exact policy text is visible without navigating away.
- The policy version and effective date are visible.
- Historical findings retain the policy version used when created.
- Updating a policy does not silently replace the version associated with an existing finding.
- If no active policy can be resolved, the interaction is held rather than cleared or escalated.
- The policy section appears before the final decision controls.

### CV-SI-013 · Add the structured reasoning chain - P0 - M

**Depends on:** `CV-SI-010`, `CV-SI-012`

As a CCO, I want to understand why ComplyVault escalated a finding so that I can assess its reasoning rather than trust an opaque score.

**Example chain**

```text
Rollover recommendation identified
+
Required comparison not located
+
Insurance affiliation present
+
Compensation disclosure not located
+
Potential principal-protection wording
=
Human supervisory review required
```

**Acceptance criteria**

- The reasoning chain contains structured individual steps.
- Each step links to evidence, context, a rule, or a policy section.
- Confidence and materiality are displayed separately.
- The interface does not show one unexplained composite risk score.
- Reviewers can expand and collapse individual steps.
- Missing evidence is worded as `not located`, not `did not occur`.
- The ruleset or model version is retained in the audit trail.

### CV-SI-014 · Add relevant client and adviser context - P0 - M

**Depends on:** `CV-SI-008`

As a CCO, I want relevant client and adviser context alongside the communication so that I can judge materiality accurately.

**Supported context**

- Client age
- Investment objective
- Risk tolerance
- Retirement proximity
- Account type
- Existing product
- Proposed product
- Adviser role
- Adviser affiliation
- Adviser regulatory history
- Previous related findings
- Firm risk profile

**Acceptance criteria**

- Only relevant context fields are displayed.
- Every context field identifies its source.
- Context cannot be silently edited from the finding page.
- Missing context is shown as unavailable.
- Contradictory context places the interaction on hold when necessary.
- Restricted context follows role permissions.

---

## Epic 5 - Human Decision and Remediation

### CV-SI-015 · Add in-finding decision actions - P0 - L

**Depends on:** `CV-SI-008`

As an authorised compliance reviewer, I want to dismiss, approve, remediate, or escalate directly from the finding so that I can close the supervisory loop without moving to another workflow.

**Decisions**

- Dismiss
- Approve
- Remediate
- Escalate

**Common requirements**

Every decision requires:

- Reviewer identity
- Rationale
- Evidence considered
- Explicit confirmation

**Acceptance criteria**

- All four actions are available inside the finding page.
- Actions are role-controlled.
- A decision cannot be submitted without rationale.
- Every decision creates an immutable audit event.
- Closed findings remain searchable.
- A closed finding cannot be silently edited.
- Reopening requires an authorised role and written reason.
- The decision updates the Priority Inbox immediately.
- The decision is included in the supervisory record.

### CV-SI-016 · Implement dismiss finding workflow - P0 - S

**Depends on:** `CV-SI-015`

As a CCO, I want to dismiss a finding with a recorded rationale so that false positives and resolved concerns remain defensible.

**Dismissal reasons**

- False positive
- Adequate disclosure located
- Adequate documentation located
- Policy not applicable
- Duplicate
- Context resolves concern
- Other

**Acceptance criteria**

- A dismissal reason is mandatory.
- Reviewer rationale is mandatory.
- The reviewer can pin mitigating evidence.
- Status becomes `Closed - Dismissed`.
- The dismissal remains visible in the supervisory trail.
- Dismissed findings contribute to quality analytics.

### CV-SI-017 · Implement approve finding workflow - P0 - S

**Depends on:** `CV-SI-015`

As a CCO, I want to approve acceptable conduct with supporting rationale so that the supervisory review is formally recorded.

**Acceptance criteria**

- Approval rationale is mandatory.
- Supporting evidence can be pinned.
- Optional conditions can be recorded.
- The reviewer may flag the adviser for future sampling.
- Status becomes `Closed - Approved`.
- The approval appears in the audit trail and export.

### CV-SI-018 · Implement remediation workflow - P0 - L

**Depends on:** `CV-SI-015`

As a CCO, I want to create remediation directly from a finding so that corrective action has an owner, deadline, and evidence requirement.

**Required fields**

- Action required
- Owner
- Supervisor
- Due date
- Severity
- Completion evidence requirement
- Client impact assessment requirement
- Follow-up review date
- Adviser notification requirement
- Potential client follow-up requirement

**Suggested actions**

- Obtain missing comparison
- Document recommendation basis
- Confirm compensation disclosure
- Correct or qualify communication
- Contact client
- Provide supervisor coaching
- Complete adviser training
- Obtain policy attestation
- Conduct expanded review

**Acceptance criteria**

- Selecting Remediate opens an in-page drawer or modal.
- Submission creates a remediation record.
- Finding status becomes `Awaiting Remediation`.
- The assigned owner can see the task.
- Required evidence is stored.
- The finding remains open until remediation is reviewed.
- Adviser completion does not automatically close the finding.
- Every remediation state change generates an audit event.

### CV-SI-019 · Implement remediation review and closure - P0 - M

**Depends on:** `CV-SI-018`

As a CCO, I want to review remediation evidence before closing the finding so that corrective action cannot be self-certified by the adviser.

**Reviewer decisions**

- Accept remediation
- Return for further work
- Escalate
- Close with residual risk
- Reopen finding

**Acceptance criteria**

- Completion evidence can be uploaded or linked.
- The remediation owner can submit completion notes.
- Only an authorised reviewer can approve final closure.
- Returned remediation requires reviewer comments.
- Historical submissions remain visible after being returned.
- Accepted remediation records completion date and reviewer.
- The final supervisory record contains remediation evidence.

### CV-SI-020 · Implement escalation workflow - P0 - M

**Depends on:** `CV-SI-015`

As a CCO, I want to escalate a material finding to the appropriate authority so that legal, executive, or specialist review can occur securely.

**Escalation destinations**

- Chief Compliance Officer
- Legal
- Firm executive
- Outside counsel
- Examination-response team
- Incident-management process

**Acceptance criteria**

- Escalation reason is mandatory.
- Destination and urgency are mandatory.
- Restricted-access mode is available.
- Interim action and next review date can be recorded.
- Status becomes `Escalated`.
- Access restrictions apply immediately.
- Existing evidence remains immutable.
- The escalation event appears in the supervisory trail.

---

## Epic 6 - Supervisory Trail and Record

### CV-SI-021 · Create append-only supervisory audit events - P0 - L

As a CCO or examiner, I want a complete chronological history of system and human actions so that the firm can demonstrate how supervision occurred.

**Required events**

- Interaction ingested
- Source validated
- Adviser resolved
- Client resolved
- Evidence identified
- Policy evaluated
- Outcome assigned
- Finding created
- Finding assigned
- Finding opened
- Evidence opened
- Note added
- Decision made
- Remediation created
- Remediation updated
- Evidence submitted
- Remediation reviewed
- Finding closed
- Finding reopened
- Record exported

**Event fields**

- Event ID
- Timestamp
- Actor type
- Actor ID
- Action
- Object type
- Object ID
- Previous state
- New state
- Reason
- Metadata
- Policy version
- Ruleset or model version
- Correlation ID

**Acceptance criteria**

- Audit events are append-only.
- Events cannot be deleted from the application.
- Corrections create new events.
- Every state-changing API call creates an event.
- Human actions identify the user.
- Machine actions identify the processing version.
- Events are displayed chronologically.
- Tenant permissions apply to the trail.

### CV-SI-022 · Build the supervisory timeline component - P0 - M

**Depends on:** `CV-SI-021`

As a reviewer, I want to view the full supervision timeline so that I can see how the finding progressed from ingestion through resolution.

**Acceptance criteria**

- The finding page shows a chronological timeline.
- System and human events are visually distinct.
- Events display actor, action, and timestamp.
- State changes show previous and new states.
- Events can be expanded for metadata.
- The timeline updates after a decision without a full page refresh.
- The demo rollover finding shows interaction ingestion, evidence identification, policy evaluation, priority routing, reviewer action, and remediation assignment.

### CV-SI-023 · Generate the completed supervisory record - P0 - L

**Depends on:** `CV-SI-010`, `CV-SI-012`, `CV-SI-015`, `CV-SI-021`

As a CCO, I want a completed supervisory record containing the finding, evidence, policy, decision, and remediation so that the firm can demonstrate its supervision.

**Record contents**

- Finding summary
- Interaction metadata
- Pinned evidence
- Applicable policy
- Policy version
- Reasoning chain
- Context considered
- Human decision
- Reviewer rationale
- Remediation
- Completion evidence
- Final status
- Audit trail

**Acceptance criteria**

- The record can be generated from a closed finding.
- Record contents match the final finding state.
- Historical policy versions are retained.
- Pinned evidence is included.
- Human and system content are labelled.
- The record contains no unsupported compliance conclusion.
- Record generation creates an audit event.

### CV-SI-024 · Export supervisory record - P0 - M

**Depends on:** `CV-SI-023`

As a CCO or examiner, I want to export the supervisory record so that it can be reviewed outside ComplyVault.

**Required format**

- PDF

**Additional supported formats**

- Structured JSON
- CSV metadata
- Evidence bundle ZIP

**Acceptance criteria**

- Export reason is mandatory.
- Export permission is role-controlled.
- The export includes policy version and decision rationale.
- Export creation generates an audit event.
- Generated records contain the firm and finding identifiers.
- Watermarking can be enabled.
- Client information can be redacted.
- The PDF renders consistently for the seeded rollover finding.

---

## Epic 7 - AdvizorStack Partner Command Layer

### CV-SI-025 · Build portfolio control intelligence view - P0 - L

**Depends on:** `CV-SI-004`, `CV-SI-006`

As an AdvizorStack compliance executive, I want to see findings grouped by control across firms so that I can identify systemic supervisory weaknesses.

**Page:** `/controls`

**Columns**

- Control area
- Total findings
- Open findings
- Open remediation
- Overdue remediation
- Firms affected
- Advisers affected
- Repeat advisers
- Current trend
- Median review time
- Median remediation time

**Acceptance criteria**

- Controls aggregate across authorised firms.
- Clicking a control opens supporting firm and finding data.
- Counts reconcile with underlying records.
- Cross-firm aggregates do not expose unauthorised client data.
- Low-volume trends are labelled appropriately.
- The seeded dataset shows seven rollover findings, three firms affected, two repeat advisers, three open rollover remediation tasks, and an increasing rollover trend.

### CV-SI-026 · Detect repeated adviser and control patterns - P0 - M

**Depends on:** `CV-SI-025`

As a compliance executive, I want repeated patterns surfaced automatically so that I can intervene before isolated findings become systemic issues.

**Initial pattern rules**

Create a pattern when:

- The same adviser has at least two findings for the same control
- A firm has a material increase in one control
- The same conduct occurs across multiple advisers
- Remediation ageing exceeds threshold
- A control has a high dismissal rate
- Required evidence is repeatedly missing
- Sampling coverage falls below target

**Acceptance criteria**

- Every pattern links to supporting records.
- A pattern stores first seen, last seen, and occurrence count.
- Closed findings remain part of historical trend calculations.
- Duplicate findings do not inflate pattern counts.
- Pattern generation produces an audit event.
- Seeded data identifies the repeated rollover adviser pattern.

### CV-SI-027 · Build firm supervision drill-down - P0 - M

**Depends on:** `CV-SI-004`, `CV-SI-025`

As an AdvizorStack compliance executive, I want to drill from a portfolio pattern into a specific firm so that I can understand where intervention is needed.

**Page:** `/firms/:firmId/supervision`

**Sections**

- Interaction coverage
- Priority findings
- Routine samples
- Open remediation
- Control performance
- Adviser patterns
- Held interactions
- Policy coverage
- Review ageing
- Recent decisions

**Acceptance criteria**

- Partner metrics reconcile with the firm view.
- Users cannot access unauthorised firms.
- Source coverage gaps are visible.
- Missing policy coverage is visible.
- Users can drill from firm to control, adviser, and finding.
- Returning to the portfolio view preserves filters.

---

## Epic 8 - Security and Multi-Firm Isolation

### CV-SI-028 · Enforce partner, firm, and role permissions - P0 - L

As a firm or partner administrator, I want supervision data protected by tenant and role permissions so that one firm cannot access another firm's evidence.

**Roles**

- Partner administrator
- Partner compliance executive
- Firm CCO
- Compliance analyst
- Supervising principal
- Adviser
- Auditor or examiner

**Acceptance criteria**

- All API requests require tenant context.
- API permissions match UI permissions.
- Partner aggregates expose only authorised firms.
- Partner users cannot access client evidence without firm-level authority.
- Advisers can view only assigned remediation.
- Advisers cannot view internal compliance notes.
- Restricted escalations have additional permissions.
- Object-level access tests exist for findings, interactions, evidence, and exports.
- Permission failures create security audit events.
- No record existence is revealed in unauthorised error responses.

### CV-SI-029 · Add synthetic AdvizorStack production tenant - P0 - M ✅ done (2026-08-04)

**Depends on:** core data model stories

As a product presenter, I want a deterministic synthetic production tenant so that the complete demo works without exposing real client information.

**Firms**

- Secure Investment Management
- Desert Ridge Wealth
- Northstar Advisory

**Required data**

- 147 processed interactions
- 139 cleared
- 5 sampled
- 3 Priority findings
- 4 open remediation tasks
- 7 rollover-documentation findings across the reporting period
- 3 affected firms
- 2 repeat advisers

**Priority findings**

1. Rollover recommendation with unresolved insurance conflict
2. Unsupported performance-language concern
3. Fee-disclosure inconsistency

**Acceptance criteria**

- All data is clearly labelled synthetic.
- The data uses the production schema.
- The data can be reset deterministically.
- The full decision workflow works on the seeded findings.
- The portfolio view and underlying records reconcile.
- No live external connector is required.
- Seed scripts are idempotent.
- Stable IDs are used for the primary demonstration route.

### CV-SI-030 · Add demo reset and stable demonstration mode - P0 - M

**Depends on:** `CV-SI-029`

As a presenter, I want to reset the synthetic tenant to its starting state so that every demonstration begins with the same reliable data.

**Acceptance criteria**

- An authorised user can reset the demo tenant.
- Reset restores findings, remediation, decisions, and audit events.
- Reset cannot affect live customer tenants.
- Reset requires confirmation.
- The primary finding always opens using a stable route.
- No static screenshots are used as the main product experience.
- A clear synthetic-data banner remains visible.

---

## Epic 9 - Production Hardening

### CV-SI-031 · Add fail-closed processing behaviour - P0 - M

**Depends on:** `CV-SI-001`

As a CCO, I want uncertain or incomplete interactions held rather than silently cleared so that processing failures cannot create false confidence.

**Hold conditions**

- Active policy unavailable
- Original source unavailable
- Adviser unresolved
- Required client context unresolved
- Processing failed
- Confidence below threshold
- Material context contradictory

**Acceptance criteria**

- Hold conditions never produce `Cleared`.
- The exact hold reason is stored.
- Held interactions appear in Command Centre metrics.
- Authorised users can retry processing.
- Retry preserves prior audit history.
- A successful retry assigns a new outcome.
- A held item can be manually escalated by an authorised reviewer.

### CV-SI-032 · Add loading, empty, and error states - P0 - M

As a user, I want clear application states so that I understand whether there is no work, incomplete data, or a system problem.

**Required states**

- No Priority findings
- No active policy
- Source temporarily unavailable
- Processing failure
- No portfolio patterns
- Permission denied
- No remediation tasks
- No firms available

**Acceptance criteria**

- Empty states do not look like errors.
- Processing errors do not claim that interactions were cleared.
- Retry actions are shown where appropriate.
- Permission errors do not reveal restricted data.
- No raw stack traces or database messages reach the UI.
- All primary screens have skeleton or loading states.

### CV-SI-033 · Add operational observability - P0 - M

As the product operator, I want processing and application failures observable so that production issues can be detected and diagnosed.

**Required monitoring**

- Processing success rate
- Processing latency
- Held rate
- Policy mapping failures
- Decision endpoint failures
- Remediation endpoint failures
- Export failures
- Permission failures
- Cross-tenant access attempts
- Command Centre API performance

**Acceptance criteria**

- Every request has a correlation ID.
- Structured errors include machine-readable error codes.
- Failed processing creates an operational log and audit event.
- Alerts exist for material failure rates.
- Sensitive communication content is not written to standard logs.
- The synthetic tenant can be excluded from production business metrics.

### CV-SI-034 · Add end-to-end release tests - P0 - L

**Depends on:** all P0 workflow stories

As the release owner, I want automated tests for the complete supervision workflow so that critical product paths remain stable.

**Required journeys**

Journey 1: Remediation

- Open Command Centre
- Open Priority Inbox
- Open rollover finding
- Review evidence
- Review policy
- Select Remediate
- Create task
- Verify audit event
- Submit completion evidence
- Approve closure
- Export record

Journey 2: Dismissal

- Open finding
- Locate mitigating evidence
- Dismiss with rationale
- Verify closure and timeline

Journey 3: Escalation

- Open finding
- Escalate to Legal
- Restrict access
- Verify unauthorised user cannot open it

Journey 4: Partner drill-down

- Open controls
- Select rollover control
- Open firm
- Open repeat adviser
- Open underlying finding

**Acceptance criteria**

- All four journeys pass in CI.
- Tests use deterministic synthetic data.
- Tests verify tenant isolation.
- Tests verify audit events.
- Tests verify policy versions.
- Tests verify the exported record.
- Failed journeys prevent production deployment.

---

## Critical implementation order

Implement in this order:

1. `CV-SI-001` - Supervisory outcomes
2. `CV-SI-002` - Selectivity counts
3. `CV-SI-029` - Synthetic AdvizorStack tenant
4. `CV-SI-004` - Command Centre
5. `CV-SI-006` - CCO Priority Inbox
6. `CV-SI-008` - Supervisory finding page
7. `CV-SI-010` - Evidence excerpts
8. `CV-SI-012` - Policy section
9. `CV-SI-013` - Reasoning chain
10. `CV-SI-015` - Decision actions
11. `CV-SI-018` - Remediation
12. `CV-SI-021` - Audit events
13. `CV-SI-022` - Supervisory timeline
14. `CV-SI-025` - Portfolio control intelligence
15. `CV-SI-026` - Pattern detection
16. `CV-SI-027` - Firm drill-down
17. `CV-SI-028` - Permissions and tenant isolation
18. `CV-SI-023` and `CV-SI-024` - Record and export
19. `CV-SI-030` to `CV-SI-034` - Reset, errors, observability, and testing

## Critical release path (P0)

The following stories define the critical release path:

- `CV-SI-001`
- `CV-SI-002`
- `CV-SI-004`
- `CV-SI-005`
- `CV-SI-006`
- `CV-SI-007`
- `CV-SI-008`
- `CV-SI-009`
- `CV-SI-010`
- `CV-SI-011`
- `CV-SI-012`
- `CV-SI-013`
- `CV-SI-014`
- `CV-SI-015`
- `CV-SI-016`
- `CV-SI-017`
- `CV-SI-018`
- `CV-SI-019`
- `CV-SI-020`
- `CV-SI-021`
- `CV-SI-022`
- `CV-SI-023`
- `CV-SI-024`
- `CV-SI-025`
- `CV-SI-026`
- `CV-SI-027`
- `CV-SI-028`
- `CV-SI-029`
- `CV-SI-030`
- `CV-SI-031`
- `CV-SI-032`
- `CV-SI-033`
- `CV-SI-034`

## Related docs

- [[complyvault-backlog-v5-release-1]]
- [[backlog-epics-and-stories]]
- [[product-as-built]]
