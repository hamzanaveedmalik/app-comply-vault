/**
 * Deterministic RIACT fixtures — fictional clients, threads, meetings, flags.
 */

import {
  RIACT_PRIMARY_CLIENT,
  RIACT_REFERENCE_DATE_ISO,
} from "./tenant";

export type RiactClientFixture = {
  id: string;
  name: string;
  email: string;
};

export const RIACT_CACTUS_CLIENTS: readonly RiactClientFixture[] = [
  RIACT_PRIMARY_CLIENT,
  {
    id: "riact-client-sylvia-nguyen",
    name: "Sylvia Nguyen",
    email: "sylvia.nguyen@example.com",
  },
  {
    id: "riact-client-owen-fitzgerald",
    name: "Owen Fitzgerald",
    email: "owen.fitzgerald@example.com",
  },
  {
    id: "riact-client-diana-cortez",
    name: "Diana Cortez",
    email: "diana.cortez@example.com",
  },
  {
    id: "riact-client-harold-peterson",
    name: "Harold Peterson",
    email: "harold.peterson@example.com",
  },
  {
    id: "riact-client-lena-brooks",
    name: "Lena Brooks",
    email: "lena.brooks@example.com",
  },
  {
    id: "riact-client-terrence-walsh",
    name: "Terrence Walsh",
    email: "terrence.walsh@example.com",
  },
  {
    id: "riact-client-amy-kessler",
    name: "Amy Kessler",
    email: "amy.kessler@example.com",
  },
] as const;

export type RiactEmailMessageFixture = {
  id: string;
  threadId: string;
  clientId: string;
  direction: "INBOUND" | "OUTBOUND";
  daysBeforeRef: number;
  hourUtc?: number;
  subject: string;
  body: string;
  inReplyTo?: string;
  flag?: {
    type: "FEE_DISPUTE" | "CLIENT_COMPLAINT" | "PERFORMANCE_CLAIM" | "MISSING_DISCLOSURE";
    severity: "INFO" | "WARN" | "CRITICAL";
    status: "OPEN" | "CLOSED" | "IN_REMEDIATION";
    resolutionType?: "DISMISSED_WITH_REASON" | "ADD_CONTEXT";
    resolutionNote?: string;
  };
};

/** ~22 threads, 48 messages — fee, suitability, rollover, onboarding themes. */
export const RIACT_EMAIL_MESSAGES: readonly RiactEmailMessageFixture[] = buildEmailFixtures();

function buildEmailFixtures(): RiactEmailMessageFixture[] {
  const ref = new Date(RIACT_REFERENCE_DATE_ISO);
  void ref;
  const messages: RiactEmailMessageFixture[] = [];
  let msgIndex = 0;

  const addThread = (args: {
    threadKey: string;
    client: RiactClientFixture;
    specs: Array<{
      direction: "INBOUND" | "OUTBOUND";
      daysBeforeRef: number;
      subject: string;
      body: string;
      flag?: RiactEmailMessageFixture["flag"];
    }>;
  }): void => {
    const threadId = `riact-thread-${args.threadKey}`;
    let prevMsgId: string | undefined;
    for (const [i, spec] of args.specs.entries()) {
      msgIndex += 1;
      const id = `riact-email-${String(msgIndex).padStart(3, "0")}`;
      messages.push({
        id,
        threadId,
        clientId: args.client.id,
        direction: spec.direction,
        daysBeforeRef: spec.daysBeforeRef,
        hourUtc: 14 + (msgIndex % 6),
        subject: spec.subject,
        body: spec.body,
        inReplyTo: i > 0 ? prevMsgId : undefined,
        flag: spec.flag,
      });
      prevMsgId = id;
    }
  };

  addThread({
    threadKey: "holloway-fees-01",
    client: RIACT_PRIMARY_CLIENT,
    specs: [
      {
        direction: "INBOUND",
        daysBeforeRef: 45,
        subject: "Advisory fee tier question",
        body: "Marcus Holloway here — can you confirm whether the 1.00% advisory fee still applies after we cross $750k in the managed account?",
      },
      {
        direction: "OUTBOUND",
        daysBeforeRef: 44,
        subject: "Re: Advisory fee tier question",
        body: "Marcus, the tiered fee schedule in your signed advisory agreement applies: 1.00% on the first $1M and 0.85% above that threshold. I attached the current fee disclosure summary for your records.",
      },
      {
        direction: "INBOUND",
        daysBeforeRef: 43,
        subject: "Re: Advisory fee tier question",
        body: "Thanks — that matches what we discussed. Please keep the written fee disclosure on file for our annual review.",
      },
    ],
  });

  addThread({
    threadKey: "holloway-suitability-01",
    client: RIACT_PRIMARY_CLIENT,
    specs: [
      {
        direction: "OUTBOUND",
        daysBeforeRef: 72,
        subject: "Suitability memo — income allocation update",
        body: "Marcus, following our call: the proposed shift to 40% fixed income aligns with your moderate risk profile and near-term distribution needs. The suitability worksheet is attached for your review.",
      },
      {
        direction: "INBOUND",
        daysBeforeRef: 71,
        subject: "Re: Suitability memo — income allocation update",
        body: "Reviewed and comfortable proceeding after reading the suitability summary.",
      },
    ],
  });

  addThread({
    threadKey: "holloway-rollover-email",
    client: RIACT_PRIMARY_CLIENT,
    specs: [
      {
        direction: "OUTBOUND",
        daysBeforeRef: 28,
        subject: "401(k) rollover comparison materials",
        body: "Marcus — as discussed, here is the side-by-side comparison of your former employer plan fees versus the managed IRA option. We are not recommending action until you review the disclosure packet.",
        flag: {
          type: "MISSING_DISCLOSURE",
          severity: "WARN",
          status: "IN_REMEDIATION",
        },
      },
    ],
  });

  addThread({
    threadKey: "nguyen-fees",
    client: RIACT_CACTUS_CLIENTS[1]!,
    specs: [
      {
        direction: "INBOUND",
        daysBeforeRef: 60,
        subject: "Fee invoice clarification",
        body: "Sylvia Nguyen — the Q2 advisory fee line looks correct but please confirm the wrap fee breakdown.",
      },
      {
        direction: "OUTBOUND",
        daysBeforeRef: 59,
        subject: "Re: Fee invoice clarification",
        body: "Sylvia, the wrap fee covers platform and advisory services as disclosed in Form ADV Part 2A Item 5.",
      },
    ],
  });

  addThread({
    threadKey: "nguyen-annual",
    client: RIACT_CACTUS_CLIENTS[1]!,
    specs: [
      {
        direction: "OUTBOUND",
        daysBeforeRef: 120,
        subject: "Annual review scheduling",
        body: "Sylvia, it is time for your annual review. Available slots next week for portfolio and fee discussion.",
      },
    ],
  });

  addThread({
    threadKey: "fitzgerald-onboard",
    client: RIACT_CACTUS_CLIENTS[2]!,
    specs: [
      {
        direction: "OUTBOUND",
        daysBeforeRef: 200,
        subject: "Welcome — onboarding documents",
        body: "Owen Fitzgerald, welcome to Cactus Wren Advisory. Please review the IPS questionnaire and risk profile before our onboarding call.",
      },
      {
        direction: "INBOUND",
        daysBeforeRef: 199,
        subject: "Re: Welcome — onboarding documents",
        body: "Completed the questionnaire. Looking forward to discussing goals on Thursday.",
      },
    ],
  });

  addThread({
    threadKey: "fitzgerald-fees",
    client: RIACT_CACTUS_CLIENTS[2]!,
    specs: [
      {
        direction: "INBOUND",
        daysBeforeRef: 90,
        subject: "Fee schedule follow-up",
        body: "Owen Fitzgerald — please send the updated fee brochure before we finalize the account transfer.",
      },
    ],
  });

  addThread({
    threadKey: "cortez-complaint",
    client: RIACT_CACTUS_CLIENTS[3]!,
    specs: [
      {
        direction: "INBOUND",
        daysBeforeRef: 35,
        subject: "Service concern",
        body: "Diana Cortez — I waited two weeks for a callback about my beneficiary change. Not acceptable.",
        flag: {
          type: "CLIENT_COMPLAINT",
          severity: "WARN",
          status: "CLOSED",
          resolutionType: "ADD_CONTEXT",
          resolutionNote: "CCO documented callback SLA remediation",
        },
      },
    ],
  });

  addThread({
    threadKey: "cortez-review",
    client: RIACT_CACTUS_CLIENTS[3]!,
    specs: [
      {
        direction: "OUTBOUND",
        daysBeforeRef: 150,
        subject: "Annual review summary",
        body: "Diana, thanks for meeting yesterday. We confirmed suitability, fees, and tax-loss harvesting plans in writing.",
      },
    ],
  });

  addThread({
    threadKey: "peterson-rollover",
    client: RIACT_CACTUS_CLIENTS[4]!,
    specs: [
      {
        direction: "OUTBOUND",
        daysBeforeRef: 55,
        subject: "Rollover recommendation documentation",
        body: "Harold Peterson — documenting our discussion about consolidating the old 403(b). Fee comparison attached; no recommendation until you confirm.",
      },
      {
        direction: "INBOUND",
        daysBeforeRef: 54,
        subject: "Re: Rollover recommendation documentation",
        body: "Received. I will review the fee comparison this weekend.",
      },
    ],
  });

  addThread({
    threadKey: "peterson-performance",
    client: RIACT_CACTUS_CLIENTS[4]!,
    specs: [
      {
        direction: "OUTBOUND",
        daysBeforeRef: 80,
        subject: "Market outlook — no guarantees",
        body: "Harold, as noted in writing: we cannot promise or guarantee investment performance. Past results do not ensure future returns.",
        flag: {
          type: "PERFORMANCE_CLAIM",
          severity: "INFO",
          status: "CLOSED",
          resolutionType: "DISMISSED_WITH_REASON",
          resolutionNote: "Outbound disclaimer — no promise of returns",
        },
      },
    ],
  });

  addThread({
    threadKey: "brooks-fees",
    client: RIACT_CACTUS_CLIENTS[5]!,
    specs: [
      {
        direction: "INBOUND",
        daysBeforeRef: 25,
        subject: "Advisory fee question",
        body: "Lena Brooks — is the 0.95% fee still in effect after the account rebalance?",
      },
      {
        direction: "OUTBOUND",
        daysBeforeRef: 24,
        subject: "Re: Advisory fee question",
        body: "Lena, yes — your advisory fee tier remains 0.95% on assets under management per your agreement.",
      },
    ],
  });

  addThread({
    threadKey: "walsh-suitability",
    client: RIACT_CACTUS_CLIENTS[6]!,
    specs: [
      {
        direction: "OUTBOUND",
        daysBeforeRef: 100,
        subject: "Suitability update — retirement timeline",
        body: "Terrence Walsh — updating your suitability profile for the shortened retirement horizon we discussed.",
      },
    ],
  });

  addThread({
    threadKey: "kessler-onboard",
    client: RIACT_CACTUS_CLIENTS[7]!,
    specs: [
      {
        direction: "INBOUND",
        daysBeforeRef: 170,
        subject: "New client paperwork",
        body: "Amy Kessler — signed the advisory agreement and CRS. Ready to schedule onboarding.",
      },
      {
        direction: "OUTBOUND",
        daysBeforeRef: 169,
        subject: "Re: New client paperwork",
        body: "Amy, received — onboarding call confirmed for next Tuesday with fee and suitability review.",
      },
    ],
  });

  addThread({
    threadKey: "holloway-fees-02",
    client: RIACT_PRIMARY_CLIENT,
    specs: [
      {
        direction: "INBOUND",
        daysBeforeRef: 15,
        subject: "Quarterly fee statement",
        body: "Marcus Holloway — the Q3 advisory fee on the statement matches our discussion. No concerns.",
      },
    ],
  });

  addThread({
    threadKey: "nguyen-rollover",
    client: RIACT_CACTUS_CLIENTS[1]!,
    specs: [
      {
        direction: "OUTBOUND",
        daysBeforeRef: 40,
        subject: "Rollover analysis",
        body: "Sylvia — attached rollover suitability checklist and plan fee comparison as requested.",
      },
    ],
  });

  addThread({
    threadKey: "fitzgerald-review",
    client: RIACT_CACTUS_CLIENTS[2]!,
    specs: [
      {
        direction: "OUTBOUND",
        daysBeforeRef: 65,
        subject: "Portfolio review follow-up",
        body: "Owen — confirming allocation targets and fee tier after today's portfolio review.",
      },
    ],
  });

  addThread({
    threadKey: "brooks-complaint-dismissed",
    client: RIACT_CACTUS_CLIENTS[5]!,
    specs: [
      {
        direction: "INBOUND",
        daysBeforeRef: 110,
        subject: "Statement timing",
        body: "Lena Brooks — statement arrived late this month. Frustrating but resolved now.",
        flag: {
          type: "CLIENT_COMPLAINT",
          severity: "INFO",
          status: "CLOSED",
          resolutionType: "DISMISSED_WITH_REASON",
          resolutionNote: "Client confirmed issue resolved same week",
        },
      },
    ],
  });

  addThread({
    threadKey: "walsh-fees",
    client: RIACT_CACTUS_CLIENTS[6]!,
    specs: [
      {
        direction: "INBOUND",
        daysBeforeRef: 48,
        subject: "Fee disclosure request",
        body: "Terrence Walsh — please resend the fee disclosure we reviewed at onboarding.",
      },
    ],
  });

  addThread({
    threadKey: "kessler-fees",
    client: RIACT_CACTUS_CLIENTS[7]!,
    specs: [
      {
        direction: "OUTBOUND",
        daysBeforeRef: 130,
        subject: "Fee tier confirmation",
        body: "Amy Kessler — confirming 1.00% advisory fee on your new account per signed agreement.",
      },
    ],
  });

  addThread({
    threadKey: "cortez-fees",
    client: RIACT_CACTUS_CLIENTS[3]!,
    specs: [
      {
        direction: "INBOUND",
        daysBeforeRef: 95,
        subject: "Fee comparison question",
        body: "Diana Cortez — how does our advisory fee compare to the brokerage account we discussed?",
      },
    ],
  });

  addThread({
    threadKey: "peterson-review",
    client: RIACT_CACTUS_CLIENTS[4]!,
    specs: [
      {
        direction: "OUTBOUND",
        daysBeforeRef: 140,
        subject: "Annual review — fee and suitability",
        body: "Harold Peterson — annual review completed. Fee schedule and suitability profile updated in writing.",
      },
    ],
  });

  addThread({
    threadKey: "holloway-distribution",
    client: RIACT_PRIMARY_CLIENT,
    specs: [
      {
        direction: "INBOUND",
        daysBeforeRef: 52,
        subject: "Distribution request timing",
        body: "Marcus Holloway — confirming the monthly distribution amount and tax withholding we discussed.",
      },
      {
        direction: "OUTBOUND",
        daysBeforeRef: 51,
        subject: "Re: Distribution request timing",
        body: "Marcus, the distribution schedule matches your signed IPS. Fee disclosure for the managed account is unchanged.",
      },
    ],
  });

  addThread({
    threadKey: "nguyen-crs",
    client: RIACT_CACTUS_CLIENTS[1]!,
    specs: [
      {
        direction: "INBOUND",
        daysBeforeRef: 88,
        subject: "Form CRS request",
        body: "Sylvia Nguyen — please send the updated Form CRS before our next review.",
      },
    ],
  });

  addThread({
    threadKey: "fitzgerald-allocation",
    client: RIACT_CACTUS_CLIENTS[2]!,
    specs: [
      {
        direction: "OUTBOUND",
        daysBeforeRef: 42,
        subject: "Allocation change confirmation",
        body: "Owen Fitzgerald — documenting the moderate growth allocation change and associated advisory fee tier.",
      },
    ],
  });

  addThread({
    threadKey: "cortez-estate",
    client: RIACT_CACTUS_CLIENTS[3]!,
    specs: [
      {
        direction: "OUTBOUND",
        daysBeforeRef: 78,
        subject: "Estate coordination note",
        body: "Diana Cortez — following up on beneficiary designations discussed at your quarterly check-in.",
      },
      {
        direction: "INBOUND",
        daysBeforeRef: 77,
        subject: "Re: Estate coordination note",
        body: "Received — I will send the signed beneficiary form this week.",
      },
    ],
  });

  addThread({
    threadKey: "brooks-rollover-2",
    client: RIACT_CACTUS_CLIENTS[5]!,
    specs: [
      {
        direction: "OUTBOUND",
        daysBeforeRef: 33,
        subject: "Rollover suitability checklist",
        body: "Lena Brooks — attached rollover suitability checklist and plan fee comparison as requested.",
      },
    ],
  });

  addThread({
    threadKey: "walsh-review",
    client: RIACT_CACTUS_CLIENTS[6]!,
    specs: [
      {
        direction: "OUTBOUND",
        daysBeforeRef: 125,
        subject: "Annual review confirmation",
        body: "Terrence Walsh — confirming annual review covered fees, suitability, and retirement timeline updates.",
      },
    ],
  });

  addThread({
    threadKey: "kessler-suitability",
    client: RIACT_CACTUS_CLIENTS[7]!,
    specs: [
      {
        direction: "INBOUND",
        daysBeforeRef: 155,
        subject: "Risk profile question",
        body: "Amy Kessler — can we revisit the moderate risk rating before increasing equity exposure?",
      },
      {
        direction: "OUTBOUND",
        daysBeforeRef: 154,
        subject: "Re: Risk profile question",
        body: "Amy, happy to refresh the suitability worksheet before any allocation change. Fee tier remains unchanged.",
      },
    ],
  });

  addThread({
    threadKey: "holloway-complaint-resolved",
    client: RIACT_PRIMARY_CLIENT,
    specs: [
      {
        direction: "INBOUND",
        daysBeforeRef: 105,
        subject: "Callback delay",
        body: "Marcus Holloway — I had to chase twice for a callback on the beneficiary form. Not ideal.",
        flag: {
          type: "CLIENT_COMPLAINT",
          severity: "INFO",
          status: "CLOSED",
          resolutionType: "ADD_CONTEXT",
          resolutionNote: "Service recovery documented same week",
        },
      },
    ],
  });

  addThread({
    threadKey: "nguyen-performance",
    client: RIACT_CACTUS_CLIENTS[1]!,
    specs: [
      {
        direction: "OUTBOUND",
        daysBeforeRef: 66,
        subject: "Performance discussion follow-up",
        body: "Sylvia — as noted, we cannot guarantee returns. Attached Q2 commentary without performance promises.",
      },
    ],
  });

  addThread({
    threadKey: "peterson-fee-tier",
    client: RIACT_CACTUS_CLIENTS[4]!,
    specs: [
      {
        direction: "INBOUND",
        daysBeforeRef: 118,
        subject: "Fee tier verification",
        body: "Harold Peterson — please confirm the 0.90% tier still applies after the rebalance.",
      },
    ],
  });

  return messages;
}

export type RiactMeetingFixture = {
  id: string;
  clientId: string;
  clientName: string;
  meetingType: string;
  daysBeforeRef: number;
  topics: string[];
  flag?: {
    id: string;
    type: "MISSING_DISCLOSURE" | "FEE_DISPUTE" | "PERFORMANCE_CLAIM";
    severity: "INFO" | "WARN" | "CRITICAL";
    status: "OPEN" | "CLOSED" | "IN_REMEDIATION";
    resolutionType?: "DISMISSED_WITH_REASON" | "ADD_CONTEXT";
    resolutionNote?: string;
  };
};

export const RIACT_MEETINGS: readonly RiactMeetingFixture[] = [
  {
    id: "riact-mtg-001",
    clientId: RIACT_PRIMARY_CLIENT.id,
    clientName: RIACT_PRIMARY_CLIENT.name,
    meetingType: "Annual Review",
    daysBeforeRef: 70,
    topics: ["advisory fees", "suitability", "tax planning"],
  },
  {
    id: "riact-mtg-002",
    clientId: RIACT_PRIMARY_CLIENT.id,
    clientName: RIACT_PRIMARY_CLIENT.name,
    meetingType: "Suitability Discussion",
    daysBeforeRef: 30,
    topics: ["401(k) rollover comparison", "fee disclosure"],
    flag: {
      id: "riact-flag-001",
      type: "MISSING_DISCLOSURE",
      severity: "WARN",
      status: "IN_REMEDIATION",
    },
  },
  {
    id: "riact-mtg-003",
    clientId: "riact-client-sylvia-nguyen",
    clientName: "Sylvia Nguyen",
    meetingType: "Annual Review",
    daysBeforeRef: 115,
    topics: ["fee schedule", "portfolio rebalance"],
  },
  {
    id: "riact-mtg-004",
    clientId: "riact-client-owen-fitzgerald",
    clientName: "Owen Fitzgerald",
    meetingType: "Onboarding",
    daysBeforeRef: 195,
    topics: ["IPS onboarding", "risk questionnaire", "fee disclosure"],
  },
  {
    id: "riact-mtg-005",
    clientId: "riact-client-diana-cortez",
    clientName: "Diana Cortez",
    meetingType: "Quarterly Check-in",
    daysBeforeRef: 145,
    topics: ["cash needs", "beneficiary update"],
  },
  {
    id: "riact-mtg-006",
    clientId: "riact-client-harold-peterson",
    clientName: "Harold Peterson",
    meetingType: "Portfolio Review",
    daysBeforeRef: 85,
    topics: ["rollover recommendation", "fee comparison"],
    flag: {
      id: "riact-flag-002",
      type: "MISSING_DISCLOSURE",
      severity: "CRITICAL",
      status: "OPEN",
    },
  },
  {
    id: "riact-mtg-007",
    clientId: "riact-client-lena-brooks",
    clientName: "Lena Brooks",
    meetingType: "Fee Conversation",
    daysBeforeRef: 22,
    topics: ["advisory fee tier", "wrap fee explanation"],
  },
  {
    id: "riact-mtg-008",
    clientId: "riact-client-terrence-walsh",
    clientName: "Terrence Walsh",
    meetingType: "Suitability Discussion",
    daysBeforeRef: 98,
    topics: ["retirement timeline", "suitability refresh"],
  },
  {
    id: "riact-mtg-009",
    clientId: "riact-client-amy-kessler",
    clientName: "Amy Kessler",
    meetingType: "Onboarding",
    daysBeforeRef: 165,
    topics: ["onboarding", "fee brochure", "Form CRS"],
  },
  {
    id: "riact-mtg-010",
    clientId: RIACT_PRIMARY_CLIENT.id,
    clientName: RIACT_PRIMARY_CLIENT.name,
    meetingType: "Quarterly Check-in",
    daysBeforeRef: 10,
    topics: ["fee statement review", "distribution planning"],
  },
  {
    id: "riact-mtg-011",
    clientId: "riact-client-sylvia-nguyen",
    clientName: "Sylvia Nguyen",
    meetingType: "Portfolio Review",
    daysBeforeRef: 38,
    topics: ["rollover analysis", "suitability"],
  },
  {
    id: "riact-mtg-012",
    clientId: "riact-client-harold-peterson",
    clientName: "Harold Peterson",
    meetingType: "Annual Review",
    daysBeforeRef: 135,
    topics: ["annual review", "fee disclosure", "performance disclaimers"],
    flag: {
      id: "riact-flag-003",
      type: "PERFORMANCE_CLAIM",
      severity: "INFO",
      status: "CLOSED",
      resolutionType: "DISMISSED_WITH_REASON",
      resolutionNote: "Advisor read required performance disclaimer — no guarantee given",
    },
  },
  {
    id: "riact-mtg-013",
    clientId: "riact-client-diana-cortez",
    clientName: "Diana Cortez",
    meetingType: "Annual Review",
    daysBeforeRef: 175,
    topics: ["annual review", "fee tier", "estate coordination"],
  },
  {
    id: "riact-mtg-014",
    clientId: "riact-client-owen-fitzgerald",
    clientName: "Owen Fitzgerald",
    meetingType: "Portfolio Review",
    daysBeforeRef: 62,
    topics: ["allocation targets", "fee tier confirmation"],
  },
  {
    id: "riact-mtg-015",
    clientId: "riact-client-lena-brooks",
    clientName: "Lena Brooks",
    meetingType: "Annual Review",
    daysBeforeRef: 210,
    topics: ["annual review", "suitability", "fee schedule"],
    flag: {
      id: "riact-flag-004",
      type: "FEE_DISPUTE",
      severity: "WARN",
      status: "CLOSED",
      resolutionType: "ADD_CONTEXT",
      resolutionNote: "Fee concern resolved with written tier confirmation",
    },
  },
];

/** Thin-firm dressing — a few clients each, no evidence. */
export const RIACT_THIN_CLIENTS: Record<
  "riact-ws-vermillion" | "riact-ws-pinal",
  readonly RiactClientFixture[]
> = {
  "riact-ws-vermillion": [
    { id: "riact-vc-client-001", name: "Claire Brennan", email: "claire.brennan@example.com" },
    { id: "riact-vc-client-002", name: "Noah Ishikawa", email: "noah.ishikawa@example.com" },
    { id: "riact-vc-client-003", name: "Grace Holloway", email: "grace.holloway@example.com" },
  ],
  "riact-ws-pinal": [
    { id: "riact-pr-client-001", name: "Benjamin Ortiz", email: "benjamin.ortiz@example.com" },
    { id: "riact-pr-client-002", name: "Rachel Kim", email: "rachel.kim@example.com" },
    { id: "riact-pr-client-003", name: "Omar Haddad", email: "omar.haddad@example.com" },
    { id: "riact-pr-client-004", name: "Sofia Alvarez", email: "sofia.alvarez@example.com" },
  ],
};

export function daysBeforeReference(days: number, hourUtc = 14): Date {
  const ref = new Date(RIACT_REFERENCE_DATE_ISO);
  return new Date(ref.getTime() - days * 86_400_000 - (12 - hourUtc) * 3_600_000);
}
