"use client";

import { useRouter } from "next/navigation";
import { Package } from "lucide-react";
import { useLiveQuery } from "@/hooks/use-live-query";
import { getDb } from "@/db/aero-db";
import { jobService } from "@/services/aero/jobService";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { toDateInputValue } from "@/lib/format";
import type { AeroReceiptLine } from "@/types/aeroswift";
import { PartDetailView } from "@/features/aero/part-detail";

function qtyLabel(line: AeroReceiptLine) {
  const unit = (line.unit || "EA").toLowerCase();
  if (unit === "grams" || unit === "g" || unit === "gram") return `${line.quantity} grams`;
  return String(line.quantity);
}

function PartThumb() {
  return (
    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-[#f3f4f6] text-[8px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-muted">
      <Package className="mb-0.5 h-3.5 w-3.5" aria-hidden />
      <span>No photo</span>
    </div>
  );
}

export function UsedUpPartsView() {
  const router = useRouter();
  const lines = useLiveQuery(
    () =>
      getDb()
        .receiptLines.filter((l) => (l.usedQuantity ?? 0) > 0 && (l.usedQuantity ?? 0) >= l.quantity)
        .toArray()
        .then((rows) => rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
    [],
  );
  const jobs = useLiveQuery(() => jobService.list(), []);

  if (lines.loading) return <LoadingState />;
  if (lines.error) return <ErrorState message={lines.error} />;

  const rows = lines.data ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-[32px] font-bold leading-none tracking-tight text-foreground">Used-up parts</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">
          Nothing left of these. Kept so you can still trace where they came from and what they went on.
        </p>
      </div>

      <div className="mb-3">
        <div className="text-[15px] font-semibold text-foreground">Fully consumed</div>
        <div className="mt-0.5 text-[14px] text-muted-foreground">
          {rows.length} {rows.length === 1 ? "line" : "lines"}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3.5">Part</th>
                <th className="px-5 py-3.5">GRN</th>
                <th className="px-5 py-3.5">Certificate</th>
                <th className="px-5 py-3.5">Total qty</th>
                <th className="px-5 py-3.5">Booked to</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((line) => {
                const job = (jobs.data ?? []).find((j) => j.id === line.jobId);
                return (
                  <tr
                    key={line.id}
                    tabIndex={0}
                    className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-[#eef4fb] dark:hover:bg-accent"
                    onClick={() => router.push(`/used-up/${line.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/used-up/${line.id}`);
                      }
                    }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <PartThumb />
                        <div className="min-w-0">
                          <div className="font-semibold text-link">{line.partNumber}</div>
                          <div className="mt-0.5 text-[13px] text-muted-foreground">{line.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">GR{line.grNumber.replace(/^GR/i, "")}</div>
                      <div className="mt-0.5 text-[13px] text-muted-foreground">{toDateInputValue(line.createdAt)}</div>
                    </td>
                    <td className="px-5 py-4 text-foreground">{line.certificateNumber || "—"}</td>
                    <td className="px-5 py-4 font-semibold tabular-nums text-foreground">{qtyLabel(line)}</td>
                    <td className="px-5 py-4">
                      {job ? (
                        <button
                          type="button"
                          className="text-[13px] text-muted-foreground hover:text-link hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/jobs/${job.id}`);
                          }}
                        >
                          {job.jobNumber}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                    No used-up parts yet.
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

export function UsedUpPartDetail({ id }: { id: string }) {
  return <PartDetailView id={id} backHref="/used-up" backLabel="Used-up parts" />;
}
