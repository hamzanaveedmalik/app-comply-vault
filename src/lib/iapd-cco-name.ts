export type SecApiDirectOwner = {
  name?: string;
  titleStatus?: string;
};

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Converts ADV "LAST, FIRST, MIDDLE" format to "First Last". */
export function formatAdvPersonName(advName: string): string {
  const parts = advName
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return advName.trim();
  }
  if (parts.length === 1) {
    return titleCase(parts[0] ?? advName.trim());
  }

  const lastName = titleCase(parts[0] ?? "");
  const firstName = titleCase(parts[1] ?? "");
  if (!firstName && !lastName) {
    return advName.trim();
  }
  return `${firstName} ${lastName}`.trim();
}

export function extractCcoNameFromDirectOwners(
  owners: SecApiDirectOwner[] | null | undefined,
): string | null {
  if (!owners?.length) {
    return null;
  }

  const cco = owners.find((owner) =>
    owner.titleStatus?.toUpperCase().includes("CHIEF COMPLIANCE OFFICER"),
  );
  if (!cco?.name?.trim()) {
    return null;
  }

  return formatAdvPersonName(cco.name);
}
