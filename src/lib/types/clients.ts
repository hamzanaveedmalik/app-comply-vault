/**
 * Client correspondence DTOs — safe for client components.
 */

import type { ClientActivityType, CommunicationDirection } from "../../../generated/prisma";

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

export type ClientDetailDto = {
  id: string;
  name: string;
  status: string;
  lastContactAt: string | null;
  correspondenceCountPeriod: number;
  periodLabel: string;
  householdMembers: Array<{
    clientId: string;
    name: string;
    role: string;
  }>;
  correspondence: ClientCorrespondenceRowDto[];
};
