"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package } from "lucide-react";
import { toast } from "sonner";
import { useLiveQuery } from "@/hooks/use-live-query";
import { receiptService } from "@/services/aero/receiptService";
import { jobService } from "@/services/aero/jobService";
import { boxService } from "@/services/aero/boxService";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { UseOnJobModal } from "@/features/aero/part-modals";
import { PartDetailView } from "@/features/aero/part-detail";
import type { AeroBox, AeroReceiptLine } from "@/types/aeroswift";

function boxLabel(boxes: AeroBox[], boxId: string | null) {
  if (!boxId) return "—";
  const box = boxes.find((b) => b.id === boxId);
  if (!box) return "—";
  return box.area ? `${box.area} — ${box.name}` : box.name;
}

function PartThumb({ partNumber }: { partNumber: string }) {
  if (partNumber === "OR-118") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-[#f3e6d8] dark:bg-muted">
        <div className="h-7 w-7 rounded-full border-[5px] border-[#c46a1a] bg-[#f6d7a8]/70 shadow-inner" />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-[#f3f4f6] text-[8px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-muted">
      <Package className="mb-0.5 h-3.5 w-3.5" aria-hidden />
      <span>No photo</span>
    </div>
  );
}

export function OutWithSomeoneView() {
  const router = useRouter();
  const lines = useLiveQuery(() => receiptService.listOut(), []);
  const boxes = useLiveQuery(() => boxService.list(), []);
  const openJobs = useLiveQuery(() => jobService.listOpen(), []);
  const [useLine, setUseLine] = useState<AeroReceiptLine | null>(null);
  const [putBackLine, setPutBackLine] = useState<AeroReceiptLine | null>(null);
  const [putBackBoxId, setPutBackBoxId] = useState("");

  if (lines.loading) return <LoadingState />;
  if (lines.error) return <ErrorState message={lines.error} />;

  const rows = lines.data ?? [];
  const boxRows = (boxes.data ?? []) as AeroBox[];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-[32px] font-bold leading-none tracking-tight text-foreground">Out with someone</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">
          Parts taken out of a box by a person and not back yet. Use it on a job to close it off, or put it back in a box.
        </p>
      </div>

      <div className="mb-3">
        <div className="text-[15px] font-semibold text-foreground">Currently out</div>
        <div className="mt-0.5 text-[14px] text-muted-foreground">
          {rows.length} {rows.length === 1 ? "line" : "lines"}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3.5">Part</th>
                <th className="px-5 py-3.5">Who has it</th>
                <th className="px-5 py-3.5">Quantity</th>
                <th className="px-5 py-3.5">Came from</th>
                <th className="px-5 py-3.5 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((line) => (
                <tr
                  key={line.id}
                  tabIndex={0}
                  className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-[#eef4fb] dark:hover:bg-accent"
                  onClick={() => router.push(`/out/${line.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/out/${line.id}`);
                    }
                  }}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <PartThumb partNumber={line.partNumber} />
                      <div className="min-w-0">
                        <div className="font-semibold text-link">{line.partNumber}</div>
                        <div className="mt-0.5 text-[13px] text-muted-foreground">{line.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-semibold text-foreground">{line.assignedTo || "—"}</td>
                  <td className="px-5 py-4 font-semibold tabular-nums text-foreground">{line.outQuantity}</td>
                  <td className="px-5 py-4 text-muted-foreground">{boxLabel(boxRows, line.boxId)}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        className="h-9 rounded-lg bg-brand px-3 text-sm text-brand-foreground hover:opacity-90"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUseLine(line);
                        }}
                      >
                        Use on a job
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-lg border-border bg-card"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPutBackBoxId(line.boxId ?? "");
                          setPutBackLine(line);
                        }}
                      >
                        Put back in a box
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                    Nothing currently out with someone.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {useLine ? (
        <UseOnJobModal
          key={`out-use-${useLine.id}`}
          open
          line={useLine}
          boxes={boxRows}
          jobs={(openJobs.data ?? []).map((j) => ({
            id: j.id,
            jobNumber: j.jobNumber,
            title: j.title,
            engineType: j.engineType,
          }))}
          currentJobId={useLine.jobId ?? ""}
          onClose={() => setUseLine(null)}
          onRecorded={(jobId) => {
            setUseLine(null);
            if (jobId) router.push(`/jobs/${jobId}`);
          }}
        />
      ) : null}

      {putBackLine ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPutBackLine(null)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground">Put back in a box</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {putBackLine.partNumber} · {putBackLine.outQuantity} out with {putBackLine.assignedTo || "someone"}
            </p>
            <select
              className="mt-4 flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={putBackBoxId}
              onChange={(e) => setPutBackBoxId(e.target.value)}
            >
              <option value="">Select a box</option>
              {boxRows.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.area ? `${b.area} — ${b.name}` : b.name}
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPutBackLine(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-brand text-brand-foreground hover:opacity-90"
                onClick={async () => {
                  if (!putBackBoxId) {
                    toast.error("Pick a box");
                    return;
                  }
                  try {
                    await receiptService.returnToBox(putBackLine.id, putBackBoxId);
                    toast.success("Returned to box");
                    setPutBackLine(null);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Unable to put back");
                  }
                }}
              >
                Put back
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function OutPartDetail({ id }: { id: string }) {
  return <PartDetailView id={id} backHref="/out" backLabel="Out with someone" />;
}
