"use client";

import {
  Building2,
  CalendarDays,
  MapPin,
  Pencil,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Input } from "~/components/ui/input";
import { RiskFlagChips } from "./RiskFlagChips";
import type { IapdFirmLookupResult } from "~/lib/iapd-types";

type FirmConfirmationCardProps = {
  firm: IapdFirmLookupResult;
  ccoName: string;
  ccoSource: "iapd" | "manual";
  ccoError?: string;
  onCcoNameChange: (value: string) => void;
};

function formatAum(value: string | null): string {
  if (!value) return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toLocaleString()}`;
}

function formatFilingDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatLocation(firm: IapdFirmLookupResult): string {
  return [firm.city, firm.state].filter(Boolean).join(", ") || "Location unavailable";
}

type FactProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

function Fact({ icon, label, value }: FactProps): React.JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-light text-brand-dark">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
          {label}
        </div>
        <div className="truncate text-sm font-medium text-text-primary">{value}</div>
      </div>
    </div>
  );
}

export function FirmConfirmationCard({
  firm,
  ccoName,
  ccoSource,
  ccoError,
  onCcoNameChange,
}: FirmConfirmationCardProps): React.JSX.Element {
  const [editingCco, setEditingCco] = useState(ccoSource === "manual");
  const isPartial = firm.source === "iapd-search";

  return (
    <section
      aria-label="Firm details confirmed from SEC IAPD"
      className="overflow-hidden rounded-xl border border-surface-border bg-surface-card shadow-sm"
    >
      <header className="border-b border-surface-divider bg-gradient-to-br from-brand-light/60 to-surface-card px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-dark text-white">
            <Building2 className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-text-primary">{firm.firmName}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-dark/10 px-2 py-0.5 text-[10px] font-medium text-brand-dark">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                Verified
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-secondary">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden />
                {formatLocation(firm)}
              </span>
              {firm.secNumber ? (
                <span className="inline-flex items-center gap-1">
                  <span className="text-text-muted">SEC #</span>
                  {firm.secNumber}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <span className="text-text-muted">CRD</span>
                {firm.crdNumber}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
        <Fact
          icon={<Wallet className="h-4 w-4" aria-hidden />}
          label="Assets Under Management"
          value={formatAum(firm.aumUsd)}
        />
        <Fact
          icon={<CalendarDays className="h-4 w-4" aria-hidden />}
          label="Last ADV Filing"
          value={formatFilingDate(firm.advFilingDate)}
        />
        {firm.employees != null ? (
          <Fact
            icon={<Users className="h-4 w-4" aria-hidden />}
            label="Employees"
            value={firm.employees.toLocaleString()}
          />
        ) : null}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-light text-brand-dark">
            <UserRound className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                Chief Compliance Officer
              </div>
              {!editingCco && ccoSource === "iapd" ? (
                <button
                  type="button"
                  onClick={() => setEditingCco(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-dark hover:underline"
                  aria-label="Edit CCO name"
                >
                  <Pencil className="h-3 w-3" aria-hidden />
                  Edit
                </button>
              ) : null}
            </div>
            {editingCco ? (
              <div className="mt-1">
                <Input
                  value={ccoName}
                  onChange={(e) => onCcoNameChange(e.target.value)}
                  onBlur={() => {
                    if (ccoSource === "iapd" && ccoName.trim()) {
                      setEditingCco(false);
                    }
                  }}
                  aria-invalid={!!ccoError}
                  aria-label="Chief Compliance Officer name"
                  placeholder="Enter CCO name"
                  autoFocus={ccoSource === "iapd"}
                  className="h-8 text-sm"
                />
                {ccoError ? (
                  <p className="mt-1 text-[11px] text-semantic-danger" role="alert">
                    {ccoError}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-text-muted">
                    {ccoSource === "iapd"
                      ? "Override the value pulled from IAPD if needed."
                      : "IAPD did not return a CCO — please enter the firm's CCO."}
                  </p>
                )}
              </div>
            ) : (
              <div className="truncate text-sm font-medium text-text-primary">
                {ccoName || "—"}
              </div>
            )}
          </div>
        </div>
      </div>

      {firm.riskFlags.length > 0 ? (
        <div className="border-t border-surface-divider px-5 py-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Risk flags
            <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-normal normal-case text-text-secondary">
              derived from ADV Part 1A
            </span>
          </div>
          <RiskFlagChips flags={firm.riskFlags} onRemove={() => undefined} readOnly />
        </div>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-divider bg-surface-muted/40 px-5 py-2.5 text-[11px] text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3 text-brand-dark" aria-hidden />
          {isPartial ? (
            <>Sourced from SEC IAPD search · partial data</>
          ) : (
            <>Sourced from SEC IAPD · auto-populated from public filings</>
          )}
        </span>
        <a
          href={`https://adviserinfo.sec.gov/firm/summary/${firm.crdNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-dark hover:underline"
        >
          View on IAPD ↗
        </a>
      </footer>
    </section>
  );
}
