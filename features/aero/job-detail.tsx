"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package } from "lucide-react";
import { toast } from "sonner";
import { useLiveQuery } from "@/hooks/use-live-query";
import { jobService } from "@/services/aero/jobService";
import { receiptService } from "@/services/aero/receiptService";
import { boxService } from "@/services/aero/boxService";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { EditPartModal, UseOnJobModal } from "@/features/aero/part-modals";
import { toDateInputValue } from "@/lib/format";
import type { AeroBox, AeroReceiptLine } from "@/types/aeroswift";
import { lineInBoxQty, lineLeftQty } from "@/types/aeroswift";

export function JobDetail({ id }: { id: string }) {
  const router = useRouter();
  const job = useLiveQuery(() => jobService.get(id), [id]);
  const lines = useLiveQuery(() => receiptService.listForJob(id), [id]);
  const boxes = useLiveQuery(() => boxService.list(), []);
  const allJobs = useLiveQuery(() => jobService.listOpen(), []);
  const [editLine, setEditLine] = useState<AeroReceiptLine | null>(null);
  const [useLine, setUseLine] = useState<AeroReceiptLine | null>(null);
  const [completing, setCompleting] = useState(false);

  if (job.loading || lines.loading) return <LoadingState />;
  if (!job.data) return <ErrorState message="Job not found" />;

  const partLines = lines.data ?? [];
  const usedTotal = partLines.reduce((sum, l) => sum + (l.usedQuantity ?? 0), 0);
  const addedTotal = job.data.expectedParts > 0 ? job.data.expectedParts : partLines.reduce((sum, l) => sum + l.quantity, 0);
  const stillHeld = Math.max(0, addedTotal - usedTotal);
  const pct = addedTotal > 0 ? Math.round((usedTotal / addedTotal) * 100) : 0;

  const boxLabel = (boxId: string | null) => {
    const box = (boxes.data ?? []).find((b) => b.id === boxId);
    if (!box) return "Unassigned";
    return box.area ? `${box.area} — ${box.name}` : box.name;
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Job number</div>
          <h1 className="mt-1 text-[32px] font-bold leading-none tracking-tight text-foreground">{job.data.jobNumber}</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">{job.data.title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-lg border-border bg-card px-4 text-foreground hover:bg-muted"
            onClick={() => router.push(`/add-parts?jobId=${id}`)}
          >
            Add parts
          </Button>
          {job.data.status !== "completed" ? (
            <Button
              type="button"
              disabled={completing}
              className="h-10 rounded-lg bg-brand px-4 text-brand-foreground hover:opacity-90"
              onClick={async () => {
                const jobNumber = job.data?.jobNumber ?? "Job";
                setCompleting(true);
                try {
                  await jobService.complete(id);
                  toast.success(`${jobNumber} marked complete`);
                  router.push("/completed");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Unable to complete job");
                } finally {
                  setCompleting(false);
                }
              }}
            >
              {completing ? "Completing…" : "Mark complete"}
            </Button>
          ) : (
            <span className="inline-flex h-10 items-center rounded-lg border border-border bg-muted px-4 text-sm text-muted-foreground">
              Completed
            </span>
          )}
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <SummaryCell label="Engine" value={job.data.engineType} />
          <SummaryCell label="Engine number" value={job.data.engineSerial} />
          <SummaryCell label="Registration" value={job.data.registration} />
          <SummaryCell label="Customer" value={job.data.customer} />
          <SummaryCell label="Started" value={job.data.startDate ? toDateInputValue(job.data.startDate) : "—"} />
          <SummaryCell
            label="Parts used"
            value={String(usedTotal)}
            hint={`of ${addedTotal} added · ${pct}%`}
            emphasize
          />
          <SummaryCell label="Still held" value={String(stillHeld)} hint="in boxes or out with someone" emphasize />
        </div>
      </div>

      <section>
        <div className="mb-3">
          <h2 className="text-[20px] font-bold text-foreground">Parts on this job</h2>
          <p className="text-[14px] text-muted-foreground">{partLines.length} lines</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3.5">Part</th>
                  <th className="px-4 py-3.5">GRN / added</th>
                  <th className="px-4 py-3.5 text-center">Total qty</th>
                  <th className="px-4 py-3.5 text-center">Used</th>
                  <th className="px-4 py-3.5 text-center">Left</th>
                  <th className="px-4 py-3.5">Where it is</th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {partLines.map((line) => {
                  const left = lineLeftQty(line);
                  const inBox = lineInBoxQty(line);
                  const usedUp = left === 0;
                  const available = inBox + (line.outQuantity ?? 0);
                  return (
                    <tr
                      key={line.id}
                      className="border-b border-border last:border-0 transition-colors hover:bg-[#eef4fb] dark:hover:bg-accent"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-start gap-3">
                          <PartThumb partNumber={line.partNumber} />
                          <div className="min-w-0">
                            <div className="font-semibold text-link">{line.partNumber}</div>
                            <div className="mt-0.5 text-[13px] text-muted-foreground">{line.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground">GR{line.grNumber.replace(/^GR/i, "")}</div>
                        <div className="mt-0.5 text-[13px] text-muted-foreground">
                          added {toDateInputValue(line.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center tabular-nums text-foreground">{line.quantity}</td>
                      <td className="px-4 py-3.5 text-center tabular-nums text-foreground">{line.usedQuantity ?? 0}</td>
                      <td
                        className={`px-4 py-3.5 text-center tabular-nums ${
                          left > 0 ? "font-semibold text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {left}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {usedUp ? <WhereBadge tone="muted">Used up</WhereBadge> : null}
                          {inBox > 0 ? (
                            <WhereBadge tone="box">
                              {inBox} in {boxLabel(line.boxId)}
                            </WhereBadge>
                          ) : null}
                          {(line.outQuantity ?? 0) > 0 ? (
                            <WhereBadge tone="out">
                              {line.outQuantity} with {line.assignedTo || "someone"}
                            </WhereBadge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={usedUp || available < 1}
                            className="h-8 rounded-lg bg-brand px-3 text-[13px] font-medium text-brand-foreground hover:opacity-90 disabled:bg-[#e5e7eb] disabled:text-[#9ca3af] dark:disabled:bg-muted dark:disabled:text-muted-foreground"
                            onClick={() => setUseLine(line)}
                          >
                            Use
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-lg border-border bg-card px-3 text-[13px] font-medium text-foreground hover:bg-muted"
                            onClick={() => setEditLine(line)}
                          >
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {partLines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      No parts yet.{" "}
                      <button
                        type="button"
                        className="font-medium text-link hover:underline"
                        onClick={() => router.push(`/add-parts?jobId=${id}`)}
                      >
                        Add parts
                      </button>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <EditPartModal
        key={editLine?.id ?? "edit-closed"}
        open={Boolean(editLine)}
        line={editLine}
        boxes={(boxes.data ?? []) as AeroBox[]}
        onClose={() => setEditLine(null)}
        onSaved={() => setEditLine(null)}
      />

      <UseOnJobModal
        key={useLine?.id ?? "use-closed"}
        open={Boolean(useLine)}
        line={useLine}
        boxes={(boxes.data ?? []) as AeroBox[]}
        jobs={(allJobs.data ?? []).map((j) => ({
          id: j.id,
          jobNumber: j.jobNumber,
          title: j.title,
          engineType: j.engineType,
        }))}
        currentJobId={id}
        onClose={() => setUseLine(null)}
        onRecorded={(jobId) => {
          setUseLine(null);
          if (jobId !== id) router.push(`/jobs/${jobId}`);
        }}
      />
    </div>
  );
}

function SummaryCell({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasize?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={`mt-1.5 font-semibold text-foreground ${emphasize ? "text-[26px] leading-none tracking-tight" : "text-[15px]"}`}>
        {value}
      </div>
      {hint ? <div className="mt-1.5 text-[12px] leading-snug text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function PartThumb({ partNumber }: { partNumber: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-[#f3f4f6] text-muted-foreground dark:bg-muted">
      <Package className="h-4 w-4" aria-hidden />
      <span className="sr-only">{partNumber}</span>
    </div>
  );
}

function WhereBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "box" | "out" | "muted";
}) {
  const dot = {
    box: "bg-[#3b82f6]",
    out: "bg-violet-500",
    muted: "bg-[#9ca3af]",
  };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-[#f3f4f6] px-2.5 py-1 text-[12px] font-medium text-foreground dark:bg-muted">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot[tone]}`} aria-hidden />
      {children}
    </span>
  );
}
