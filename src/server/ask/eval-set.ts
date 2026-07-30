/**
 * CV-AX-05a evaluation set — 10 topics × 3 phrasings.
 * Record recall against the demo workspace after demo-embed-backfill.
 */

export type AskEvalCase = {
  topicId: string;
  topic: string;
  phrasings: [string, string, string];
  /** Expected: cited answer for rehearsed/paraphrased; honest-miss allowed for open. */
  expectKind: "answer" | "honest-miss" | "either";
};

export const ASK_DEMO_EVAL_SET: AskEvalCase[] = [
  {
    topicId: "fees-april",
    topic: "Client fee concerns since April",
    phrasings: [
      "Show me every email where a client mentioned fees since April",
      "Which clients raised fee complaints after April?",
      "Any correspondence about advisory fees from April onward?",
    ],
    expectKind: "answer",
  },
  {
    topicId: "performance-promises",
    topic: "Performance promises in writing",
    phrasings: [
      "Has any advisor promised performance in writing?",
      "Did anyone guarantee investment returns by email?",
      "Find written performance assurances to clients",
    ],
    expectKind: "either",
  },
  {
    topicId: "margaret-last-contact",
    topic: "Last contact with Margaret Ellison",
    phrasings: [
      "When did we last hear from Margaret Ellison and about what?",
      "Most recent Margaret Ellison correspondence?",
      "What was the last topic discussed with Margaret Ellison?",
    ],
    expectKind: "answer",
  },
  {
    topicId: "fee-schedule",
    topic: "Fee schedule discussions",
    phrasings: [
      "Did we discuss updating the fee schedule?",
      "Any meeting notes about fee tier changes?",
      "Show evidence of fee schedule conversations",
    ],
    expectKind: "answer",
  },
  {
    topicId: "form-crs",
    topic: "Form CRS delivery",
    phrasings: [
      "Who asked for an updated Form CRS?",
      "Any emails requesting the Form CRS brochure?",
      "Evidence that Form CRS was sent or requested",
    ],
    expectKind: "either",
  },
  {
    topicId: "ira-timing",
    topic: "IRA contribution timing",
    phrasings: [
      "Did we discuss IRA contribution timing?",
      "Any notes about IRA contributions this tax year?",
      "Client conversations on IRA funding deadlines",
    ],
    expectKind: "either",
  },
  {
    topicId: "529-college",
    topic: "529 college funding",
    phrasings: [
      "Any meetings about 529 college funding?",
      "Did a client discuss 529 contributions?",
      "Evidence of college savings plan recommendations",
    ],
    expectKind: "either",
  },
  {
    topicId: "sms-unindexed",
    topic: "SMS (deliberate honest miss)",
    phrasings: [
      "Show me SMS messages about fees",
      "What did clients say over SMS last month?",
      "Search WhatsApp for fee complaints",
    ],
    expectKind: "honest-miss",
  },
  {
    topicId: "out-of-range",
    topic: "Out-of-range date (deliberate honest miss)",
    phrasings: [
      "What fee emails do we have from 2023-02-15?",
      "Show meetings on 2023-02-15 about rollovers",
      "Any evidence dated 2023-01-01 regarding complaints?",
    ],
    expectKind: "honest-miss",
  },
  {
    topicId: "no-evidence-topic",
    topic: "No-evidence topic (deliberate honest miss)",
    phrasings: [
      "Any evidence of private jet gifts to clients?",
      "Did we document cryptocurrency mining advice?",
      "Show records of yacht purchase recommendations",
    ],
    expectKind: "honest-miss",
  },
];
