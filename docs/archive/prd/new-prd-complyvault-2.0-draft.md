---
tags:
  - archive
  - prd
---

> **Archived.** ComplyVault 2.0 vision draft — not the Release 1 source of truth.
> Use [[product-as-built]], [[complyvault-backlog-v5-release-1]], and [[prd-summary]] instead.
> See [[Archive-Map|Archive Map]].

# Product Requirements Document (PRD)

# ComplyVault 2.0

## AI-Powered Supervisory Evidence Platform

**Author:** Hamza Naveed Malik

**Status:** Draft

**Version:** 2.0

---

# Vision

ComplyVault should become the operating system for supervisory oversight within SEC-registered investment advisers.

Instead of generating documentation for every meeting, ComplyVault continuously captures advisory communications, identifies interactions that create regulatory obligations, routes only those interactions requiring supervision, and produces a complete, searchable evidence trail for SEC examinations.

The objective is not to create more documentation.

The objective is to reduce compliance workload while increasing supervisory defensibility.

---

# Problem Statement

Today's workflow creates unnecessary work.

Every recorded meeting produces:

- transcript
- summary
- documentation
- audit trail
- compliance flags

This assumes every interaction deserves equal compliance treatment.

Feedback from pilot users demonstrates this assumption is incorrect.

Compliance officers do not want more documentation.

They want:

- less manual review
- consistent supervision
- confidence nothing important is missed
- rapid evidence retrieval during examinations

The current product is documentation-first.

The redesigned product will be supervision-first.

---

# Product Principles

## Principle 1

Capture broadly.

Never depend on advisers deciding what should be retained.

---

## Principle 2

Route attention.

AI determines what requires supervisory review.

AI never determines what is retained.

---

## Principle 3

Evidence first.

Every supervisory decision should be backed by contemporaneous evidence.

---

## Principle 4

Reduce work.

AI should eliminate unnecessary review rather than generate unnecessary review.

---

## Principle 5

Examination readiness.

Every workflow should improve the firm's ability to demonstrate consistent supervisory oversight.

---

# Target Users

Primary

- Chief Compliance Officers

Secondary

- Outsourced CCO firms
- Compliance Analysts
- Supervisory Principals

Tertiary

- Financial Advisers

---

# Product Goals

The platform should allow a compliance officer to answer:

- What requires my attention today?
- Which advisers represent elevated supervisory risk?
- Which interactions require review?
- Can I demonstrate supervision?
- Can I produce evidence immediately if examined?

---

# Core Workflow

```
Client Interaction

↓

Capture

↓

AI Analysis

↓

Risk Classification

↓

Review Required?

├── Yes
│
│ Review Queue
│
│ Supervisor Decision
│
│ Attestation
│
└── No
│
Retained as Evidence

↓

Searchable Timeline

↓

Exam Export
```

---

# Product Architecture

## Module 1

Universal Evidence Capture

Purpose

Capture advisory interactions without requiring human intervention.

Sources

- Zoom
- Microsoft Teams
- Outlook (future)
- Gmail (future)
- CRM Notes (future)
- Business Messaging (future)

Outputs

- transcript
- metadata
- participants
- timestamps
- recording references

Success

Every supported interaction becomes retrievable evidence according to firm policy.

---

## Module 2

AI Compliance Intelligence

Purpose

Understand the regulatory significance of interactions.

Detect

Investment recommendations

Suitability discussions

Conflicts of interest

Complaints

Trading instructions

Performance discussions

Marketing activity

Required disclosures

Material changes

Outside business activities

Discretionary authority

Risk Outputs

Risk Level

Low

Medium

High

Confidence Score

Detected Topics

Required Disclosures

Recommended Actions

---

## Module 3

Supervisory Review Queue

Purpose

Present only interactions requiring human supervision.

Each queue item contains

Client

Adviser

Interaction Summary

Detected Risks

Transcript Excerpts

Required Actions

Previous History

Supervisor can

Approve

Escalate

Assign

Request Adviser Response

Close

Every decision creates supervisory evidence.

---

## Module 4

Evidence Repository

Purpose

Maintain a searchable evidence archive.

Search by

Client

Adviser

Date

Risk

Disclosure

Keyword

Communication Type

Outputs

Complete evidence history

Export package

Supervisory actions

Supporting communications

---

## Module 5

Client Evidence Timeline

Chronological history of

Meetings

Emails

Messages

CRM Notes

Documents

Reviews

Approvals

Attestations

Flags

This becomes the primary examination interface.

---

## Module 6

Policy Engine

Purpose

Firm-specific supervisory configuration.

Configure

Disclosure mappings

ADV mappings

Risk thresholds

Review rules

Required disclosures

Escalation policies

Retention policies

Never-suppress rules

The Policy Engine should rarely be visited after implementation.

---

# New Navigation

Dashboard

Review Queue

Interaction Log

Clients

Evidence Repository

Reports

Policy Engine

Integrations

Administration

---

# Dashboard

The Dashboard answers one question:

"What needs my attention?"

Widgets

Interactions awaiting review

High-risk interactions

Overdue reviews

Advisor risk ranking

Recent complaints

Disclosure exceptions

Evidence capture health

Review SLA

Examination readiness

Export readiness

The dashboard should never function as a settings page.

---

# Review Queue

The primary daily workspace.

Each interaction displays

Risk

AI explanation

Detected disclosures

Timeline

Transcript

Supervisor Actions

Nothing else matters more than this screen.

---

# Evidence Repository

Allows SEC-style retrieval.

Example queries

All communications for Client X

All suitability discussions

All complaints

All interactions involving Adviser Smith

All interactions between Jan-Mar

One-click export.

---

# AI Responsibilities

AI should

Capture

Classify

Prioritise

Recommend

Explain

Never

Delete evidence

Suppress retention

Modify history

Rewrite supervisory decisions

---

# Success Metrics

Operational

80% reduction in manual documentation

90% reduction in compliance review time

95% AI classification accuracy

Less than 5% false negatives

Business

Daily active CCO usage

Average review time

Interactions reviewed

Export generation time

Customer retention

Compliance

100% searchable evidence

Complete supervisory audit trail

Tamper-evident history

Examination export under five minutes

---

# Future Roadmap

Phase 1

Meeting supervision

Review Queue

Evidence Repository

Dashboard redesign

Policy Engine

Phase 2

Email ingestion

Teams integration

CRM integration

Client timeline

Risk analytics

Phase 3

Cross-channel supervision

Predictive adviser risk scoring

Annual review automation

SEC examination workspace

AI-powered deficiency detection

---

# Guiding Philosophy

ComplyVault is not a meeting documentation platform.

It is an AI-native supervisory evidence platform.

The product exists to ensure that firms can continuously supervise advisory communications, reduce compliance workload, and demonstrate defensible oversight during regulatory examinations.

Every feature should answer one question:

**"If the SEC examined this firm tomorrow, would this make supervision easier to demonstrate?"**

If the answer is no, the feature does not belong in the core product.
