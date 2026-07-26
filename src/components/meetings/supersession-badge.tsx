import Link from "next/link";

/**
 * CV-TR-16 — badge + link for superseded / replacement meetings in list and detail views.
 */
export function SupersessionBadge({
  supersededById,
  supersedesId,
}: {
  supersededById?: string | null;
  supersedesId?: string | null;
}): React.ReactElement | null {
  if (supersededById) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex items-center rounded-full bg-[#F1EFE8] px-2 py-0.5 text-[11px] font-medium text-[#444441]"
          aria-label="Status: superseded"
        >
          Superseded
        </span>
        <Link
          href={`/meetings/${supersededById}`}
          className="text-[11px] font-medium text-[#0D2818] underline underline-offset-2"
        >
          View replacement
        </Link>
      </span>
    );
  }
  if (supersedesId) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex items-center rounded-full bg-[#E6F1FB] px-2 py-0.5 text-[11px] font-medium text-[#0C447C]"
          aria-label="Status: supersedes prior seal"
        >
          Correction draft
        </span>
        <Link
          href={`/meetings/${supersedesId}`}
          className="text-[11px] font-medium text-[#0D2818] underline underline-offset-2"
        >
          View original
        </Link>
      </span>
    );
  }
  return null;
}
