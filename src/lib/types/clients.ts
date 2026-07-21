/**
 * Client correspondence DTOs — safe for client components.
 */

import type {
  ClientActivityType,
  CommunicationDirection,
  MeetingClientMatchConfidence,
} from "../../../generated/prisma";

export type ClientListItemDto = {
  id: string;
  name: string;
  status: string;
  lastContactAt: string | null;
};

export type ClientCorrespondenceRowDto = {
  id: string;
  type: ClientActivityType;
  direction: CommunicationDirection | null;
  title: string | null;
  counterparties: string[];
  occurredAt: string;
  contentSha256: string | null;
  threadId: string | null;
  evidenceItemId: string | null;
  viaHouseholdMember: boolean;
  memberClientName: string | null;
};

export type HouseholdMemberDto = {
  membershipId: string;
  clientId: string;
  name: string;
  role: string;
  emailAddresses: Array<{ id: string; address: string }>;
};

export type ClientDetailDto = {
  id: string;
  name: string;
  status: string;
  lastContactAt: string | null;
  correspondenceCountPeriod: number;
  periodLabel: string;
  /** Email aliases on this client record. */
  emailAddresses: Array<{ id: string; address: string }>;
  householdMembers: HouseholdMemberDto[];
  correspondence: ClientCorrespondenceRowDto[];
};

export type NeedsAttributionMeetingDto = {
  id: string;
  clientName: string;
  meetingDate: string;
  meetingType: string;
  clientId: string | null;
  clientMatchConfidence: MeetingClientMatchConfidence | null;
  participantEmails: string[];
  reason: "unmatched" | "low_confidence" | "ambiguous";
};
