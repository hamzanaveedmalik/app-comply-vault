# ComplyVault — User Journeys

> User journey maps and flow diagrams for CCO and Adviser personas.

---

## 1. CCO — First-Time Setup (Integration Connection)

```mermaid
journey
    title CCO First-Time Setup
    section Connect Zoom
      Open Integrations page: 5: CCO
      Click Connect Zoom: 5: CCO
      Redirect to Zoom OAuth: 5: CCO
      Authorize ComplyVault: 5: CCO
      Return to ComplyVault: 5: CCO
      See "Connected" banner: 5: CCO
    section Configure Scope
      Set recording scope (All/External only): 5: CCO
      Confirm setting saved: 5: CCO
```

---

## 2. CCO — Zero-Touch Meeting Capture (Happy Path)

```mermaid
journey
    title CCO Zero-Touch Meeting Capture
    section Meeting
      Adviser hosts Zoom client meeting: 5: Adviser
      Meeting ends, Zoom processes recording: 5: System
    section Auto-Ingestion
      Zoom sends recording.completed webhook: 5: System
      ComplyVault enqueues ingestion job: 5: System
      Job downloads transcript/recording: 5: System
      AI pipeline extracts & flags: 5: System
    section CCO Experience
      CCO receives "Audit pack ready" email: 5: CCO
      CCO opens dashboard: 5: CCO
      Sees new meeting in Recent Meetings: 5: CCO
      Clicks to review audit pack: 5: CCO
      Reviews extraction, addresses flags: 5: CCO
      Finalises pack: 5: CCO
```

---

## 3. CCO — End-to-End Flow (Swimlane)

```mermaid
flowchart TB
    subgraph CCO["CCO Actions"]
        A1[Connect Zoom/Teams]
        A2[Receive email: Pack ready]
        A3[Open dashboard]
        A4[Review audit pack]
        A5[Address flags]
        A6[Finalise / Sign]
    end

    subgraph System["System (Automatic)"]
        S1[Webhook received]
        S2[Ingestion job]
        S3[Extraction pipeline]
        S4[Create audit pack]
        S5[CRM note / SharePoint]
        S6[DocuSign envelope]
    end

    subgraph Adviser["Adviser"]
        Adv1[Host meeting]
        Adv2[Review pack - Phase 2]
    end

    A1 --> S1
    Adv1 --> S1
    S1 --> S2 --> S3 --> S4
    S4 --> A2
    A2 --> A3 --> A4 --> A5 --> A6
    A6 --> S5
    A6 --> S6
```

---

## 4. CCO — Dashboard Daily Check

```mermaid
journey
    title CCO Daily Dashboard Check
    section Morning
      Log in to ComplyVault: 5: CCO
      View Compliance Health Score: 5: CCO
      Check Urgent Alert Banner: 5: CCO
      Review Action Required panel: 5: CCO
    section Triage
      Click overdue signature item: 5: CCO
      Open audit pack: 5: CCO
      Remind adviser to sign: 5: CCO
    section Weekly
      Review Meeting Coverage chart: 5: CCO
      Check SEC Exam Readiness: 5: CCO
      Review Upcoming Deadlines: 5: CCO
```

---

## 5. CCO — Flagged Meeting Review

```mermaid
flowchart LR
    subgraph Trigger["Trigger"]
        Flag[AI flags suitability language]
    end

    subgraph CCO["CCO Flow"]
        Email[Email: Action required]
        Open[Open audit pack]
        Review[Review flagged section]
        Decide{Disposition?}
        Resolve[Mark Resolved]
        Dismiss[Mark Dismissed]
        Escalate[Escalate]
    end

    subgraph Outcome["Outcome"]
        CRM[Update CRM note]
        RIAB[Post to RIAB - if connected]
        ComplySci[Post to ComplySci - if flagged]
    end

    Flag --> Email
    Email --> Open --> Review --> Decide
    Decide -->|Accept| Resolve
    Decide -->|False positive| Dismiss
    Decide -->|Needs follow-up| Escalate
    Resolve --> CRM
    Escalate --> RIAB
```

---

## 6. CCO — Manual Sync (Zoom)

```mermaid
journey
    title CCO Manual Sync from Zoom
    section Problem
      Webhook not reaching app: 2: CCO
      Meetings not appearing: 2: CCO
    section Solution
      Open Integrations page: 5: CCO
      Click "Sync from Zoom": 5: CCO
      Wait for sync: 5: CCO
      See toast: "X recordings queued": 5: CCO
    section Result
      Refresh dashboard: 5: CCO
      Meetings appear in minutes: 5: CCO
```

---

## 7. Adviser — Pack Review (Phase 2 — Epic 8.4)

```mermaid
journey
    title Adviser Pack Review (Phase 2)
    section Invitation
      CCO invites adviser to workspace: 5: CCO
      Adviser receives email: 5: Adviser
      Adviser signs in: 5: Adviser
    section Review
      Sees only own meetings: 5: Adviser
      Opens audit pack: 5: Adviser
      Adds inline corrections: 5: Adviser
      Marks "Ready for CCO Review": 5: Adviser
    section Handoff
      CCO notified: 5: System
      CCO reviews with corrections: 5: CCO
```

---

## 8. User Journey Map (Experience Layers)

```mermaid
flowchart TB
    subgraph Awareness["Awareness"]
        A1[CCO learns about ComplyVault]
        A2[Signs up / Trial]
    end

    subgraph Onboarding["Onboarding"]
        O1[Create workspace]
        O2[Connect Zoom]
        O3[First meeting captured]
        O4[First audit pack ready]
    end

    subgraph Daily["Daily Use"]
        D1[Email: Pack ready]
        D2[Dashboard check]
        D3[Review & finalise]
        D4[Optional: Connect CRM, SharePoint]
    end

    subgraph Expansion["Expansion"]
        E1[Connect DocuSign]
        E2[Connect Redtail]
        E3[Connect Slack]
        E4[Adviser tier]
    end

    A1 --> A2 --> O1 --> O2 --> O3 --> O4
    O4 --> D1 --> D2 --> D3
    D3 --> D4
    D4 --> E1 --> E2 --> E3 --> E4
```

---

## 9. CCO — Pre-Meeting Briefing (Phase 2 — Epic 8.1)

```mermaid
sequenceDiagram
    participant Calendar as Google/Outlook Calendar
    participant Job as ComplyVault Cron
    participant CCO as CCO
    participant Slack as Slack (optional)

    Note over Calendar,Slack: 24 hours before meeting
    Calendar->>Job: Scheduled client meeting detected
    Job->>Job: Match attendees to CRM clients
    Job->>Job: Fetch: disclosures, suitability, flags, DocuSign
    Job->>CCO: Email pre-meeting briefing
    Job->>Slack: Slack message (if connected)
    CCO->>CCO: Review briefing
    CCO->>CCO: Ensure adviser has checklist
```

---

## 10. Touchpoint Summary

| Touchpoint | Channel | When |
|------------|---------|------|
| Integration connection | Web UI | One-time setup |
| Audit pack ready | Email | Per meeting |
| Action required | Email, Slack | When flags or overdue sigs |
| Weekly digest | Email | Monday 8AM |
| Dashboard | Web UI | Daily check |
| DocuSign | Email | When envelope sent |
| Pre-meeting briefing | Email, Slack | 24h before meeting (Phase 2) |
