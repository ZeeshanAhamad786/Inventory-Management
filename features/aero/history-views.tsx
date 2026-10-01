"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "@/hooks/use-live-query";
import { HISTORY_FILTERS, historyService, historyWhatLabel } from "@/services/aero/historyService";
import { LoadingState, ErrorState } from "@/components/shared/states";
import type { AeroHistoryEvent, HistoryWhat } from "@/types/aeroswift";
import { PartDetailView } from "@/features/aero/part-detail";

function formatWhen(value: string) {
  // Match list screenshot: 2026-08-26 09:12 (UTC stamp)
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return "—";
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}

function WhatBadge({ what }: { what: HistoryWhat }) {
  const styles: Record<HistoryWhat, { wrap: string; dot: string }> = {
    added: {
      wrap: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
      dot: "bg-emerald-500",
    },
    used: {
      wrap: "bg-muted text-muted-foreground",
      dot: "bg-[#9ca3af]",
    },
    issued: {
      wrap: "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
      dot: "bg-amber-500",
    },
    moved_to_inventory: {
      wrap: "bg-[#e8f0fe] text-[#1e3a5f] dark:bg-sky-950/40 dark:text-sky-200",
      dot: "bg-[#3b82f6]",
    },
  };
  const tone = styles[what];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${tone.wrap}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {historyWhatLabel(what)}
    </span>
  );
}

export function HistoryView() {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | HistoryWhat>("all");
  const events = useLiveQuery(() => historyService.filtered(filter), [filter]);
  const counts = useLiveQuery(() => historyService.counts(), []);

  if (events.loading || counts.loading) return <LoadingState />;
  if (events.error) return <ErrorState message={events.error} />;

  const rows = events.data ?? [];
  const c = counts.data ?? { all: 0, added: 0, used: 0, issued: 0, moved_to_inventory: 0 };
  const countFor = (key: "all" | HistoryWhat) => (key === "all" ? c.all : c[key]);

  const filterTitle =
    filter === "all" ? "Everything" : historyWhatLabel(filter);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-[32px] font-bold leading-none tracking-tight text-foreground">History</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">
          Every stock event, newest first. Nothing here can be edited or deleted — that is the point of it.
        </p>
      </div>

      <div className="mb-5">
        <div className="mb-2 text-[13px] font-medium text-muted-foreground">Filter by what happened</div>
        <div className="flex flex-wrap gap-2">
          {HISTORY_FILTERS.map((item) => {
            const active = filter === item.key;
            const n = countFor(item.key);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                <span>{item.label}</span>
                <span className={active ? "text-brand-foreground/80" : "text-muted-foreground"}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-3">
        <div className="text-[15px] font-semibold text-foreground">{filterTitle}</div>
        <div className="mt-0.5 text-[14px] text-muted-foreground">
          {rows.length} {rows.length === 1 ? "event" : "events"}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3.5">When</th>
                <th className="px-5 py-3.5">What</th>
                <th className="px-5 py-3.5">Part</th>
                <th className="px-5 py-3.5">Qty</th>
                <th className="px-5 py-3.5">Job</th>
                <th className="px-5 py-3.5">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((event) => (
                <HistoryRow key={event.id} event={event} onOpen={() => router.push(`/history/${event.lineId}`)} />
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                    No history events yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HistoryRow({ event, onOpen }: { event: AeroHistoryEvent; onOpen: () => void }) {
  return (
    <tr
      tabIndex={0}
      className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-[#eef4fb] dark:hover:bg-accent"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <td className="px-5 py-4 text-[13px] tabular-nums text-muted-foreground">{formatWhen(event.at)}</td>
      <td className="px-5 py-4">
        <WhatBadge what={event.what} />
      </td>
      <td className="px-5 py-4 font-semibold text-foreground">{event.partNumber}</td>
      <td className="px-5 py-4 tabular-nums text-foreground">{event.quantity}</td>
      <td className="px-5 py-4 text-muted-foreground">{event.jobNumber || "—"}</td>
      <td className="px-5 py-4 text-muted-foreground">{event.note || "—"}</td>
    </tr>
  );
}

export function HistoryPartDetail({ id }: { id: string }) {
  return <PartDetailView id={id} backHref="/history" backLabel="History" />;
}

export { WhatBadge, formatWhen };
