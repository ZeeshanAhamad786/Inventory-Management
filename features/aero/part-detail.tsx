"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { parseISO, isValid } from "date-fns";
import { useLiveQuery } from "@/hooks/use-live-query";
import { jobService } from "@/services/aero/jobService";
import { receiptService } from "@/services/aero/receiptService";
import { boxService } from "@/services/aero/boxService";
import { historyService, historyWhatLabel } from "@/services/aero/historyService";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { EditPartModal, UseOnJobModal } from "@/features/aero/part-modals";
import { formatQtyWithUnit, unitHint } from "@/lib/aero-format";
import { toDateInputValue } from "@/lib/format";
import type { AeroBox, AeroHistoryEvent, HistoryWhat } from "@/types/aeroswift";
import { lineInBoxQty } from "@/types/aeroswift";

function formatHistoryStamp(value: string) {
  const date = parseISO(value);
  if (!isValid(date)) return "—";
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}`;
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

export function PartDetailView({
  id,
  backHref,
  backLabel,
}: {
  id: string;
  backHref: string;
  backLabel: string;
}) {
  const router = useRouter();
  const line = useLiveQuery(() => receiptService.get(id), [id]);
  const jobs = useLiveQuery(() => jobService.list(), []);
  const openJobs = useLiveQuery(() => jobService.listOpen(), []);
  const boxes = useLiveQuery(() => boxService.list(), []);
  const history = useLiveQuery(() => historyService.listForLine(id), [id]);
  const [editOpen, setEditOpen] = useState(false);
  const [useOpen, setUseOpen] = useState(false);
  const [boxOpen, setBoxOpen] = useState(false);
  const [putBackOpen, setPutBackOpen] = useState(false);
  const [boxId, setBoxId] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const job = useMemo(() => {
    if (!line.data?.jobId) return null;
    return (jobs.data ?? []).find((j) => j.id === line.data?.jobId) ?? null;
  }, [jobs.data, line.data?.jobId]);

  const box = useMemo(() => {
    if (!line.data?.boxId) return null;
    return (boxes.data ?? []).find((b) => b.id === line.data?.boxId) ?? null;
  }, [boxes.data, line.data?.boxId]);

  if (line.loading) return <LoadingState />;
  if (!line.data) return <ErrorState message="Part not found" />;

  const part = line.data;
  const inBox = lineInBoxQty(part);
  const available = inBox + (part.outQuantity ?? 0);
  const events = history.data ?? [];
  const selected = (selectedEventId ? events.find((e) => e.id === selectedEventId) : events[0]) ?? null;
  const boxHint =
    inBox > 0 && box ? `${box.area ? `${box.area} — ` : ""}${box.name}` : inBox > 0 ? "boxed" : "not boxed";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-1 text-[13px] text-muted-foreground">
        <Link href={backHref} className="hover:text-link hover:underline">
          {backLabel}
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-foreground">{part.partNumber}</span>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Part number</div>
          <h1 className="mt-1 text-[32px] font-bold leading-none tracking-tight text-foreground">{part.partNumber}</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">{part.description}</p>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Batch {part.batchNumber || "—"} · GR{part.grNumber.replace(/^GR/i, "")} · added {toDateInputValue(part.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={available < 1}
            className="h-9 rounded-lg bg-brand px-3 text-sm text-brand-foreground hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground"
            onClick={() => setUseOpen(true)}
          >
            Use on a job
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg border-border bg-card"
            disabled={inBox < 1}
            onClick={async () => {
              try {
                await receiptService.issueToPerson(part.id, "Stores tech", 1);
                toast.success("Issued out with someone");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to issue");
              }
            }}
          >
            Issue
          </Button>
          {(part.outQuantity ?? 0) > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg border-border bg-card"
              onClick={() => {
                setBoxId(part.boxId ?? "");
                setPutBackOpen(true);
              }}
            >
              Put back in a box
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg border-border bg-card"
            onClick={() => {
              setBoxId(part.boxId ?? "");
              setBoxOpen(true);
            }}
          >
            Change box
          </Button>
          <button
            type="button"
            className="h-9 px-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setEditOpen(true)}
          >
            Edit
          </button>
          <button
            type="button"
            className="h-9 px-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400"
            onClick={async () => {
              if (!window.confirm(`Delete ${part.partNumber}?`)) return;
              await receiptService.delete(part.id);
              toast.success("Part deleted");
              router.push(backHref);
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-bold text-foreground">Quantities</h2>
            <p className="text-[14px] text-muted-foreground">Used a part by mistake? Edit puts it back.</p>
          </div>
          <Button type="button" variant="outline" className="h-9 rounded-lg border-border bg-card" onClick={() => setEditOpen(true)}>
            Edit quantities
          </Button>
        </div>
        <div className="grid gap-0 overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2 xl:grid-cols-4">
          <QtyStat label="Total quantity" value={String(part.quantity)} hint={unitHint(part.unit)} />
          <QtyStat label="Used" value={String(part.usedQuantity ?? 0)} hint="fitted to engines" />
          <QtyStat label="In the box" value={String(inBox)} hint={boxHint} />
          <QtyStat
            label="Out with someone"
            value={String(part.outQuantity ?? 0)}
            hint={(part.outQuantity ?? 0) > 0 ? part.assignedTo || "out" : "nothing out"}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <h2 className="text-[20px] font-bold text-foreground">History</h2>
          <p className="mt-0.5 text-[14px] text-muted-foreground">Every event for this part, newest first.</p>
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
            {events.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No events for this part yet.</div>
            ) : (
              events.map((event) => (
                <HistoryEventRow
                  key={event.id}
                  event={event}
                  unit={part.unit}
                  selected={selected?.id === event.id}
                  onSelect={() => setSelectedEventId(event.id)}
                />
              ))
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section>
            <h2 className="text-[20px] font-bold text-foreground">Details</h2>
            <div className="mt-3 space-y-3 rounded-xl border border-border bg-card px-4 py-4">
              <DetailRow
                label="Part number"
                value={
                  part.alternativePartNumber
                    ? `${part.partNumber} · alt ${part.alternativePartNumber}`
                    : part.partNumber
                }
              />
              <DetailRow label="Batch number" value={part.batchNumber || "—"} />
              <DetailRow label="GRN" value={`GR${part.grNumber.replace(/^GR/i, "")}`} />
              <DetailRow
                label="Supplier"
                value={part.supplierName || "—"}
                hint={part.invoiceReference || undefined}
              />
              <DetailRow
                label="Cost per unit"
                value={part.costPerUnit != null ? `£${part.costPerUnit.toFixed(2)}` : "—"}
              />
              <DetailRow label="Booked to" value={job?.jobNumber ?? "—"} />
            </div>
          </section>

          <section>
            <h2 className="text-[20px] font-bold text-foreground">Certificate</h2>
            <p className="mt-0.5 text-[14px] text-muted-foreground">Reference {part.certificateNumber || "—"}</p>
            <div className="mt-3 rounded-xl border border-border bg-card p-4">
              <div className="relative flex min-h-[140px] items-center justify-center rounded-lg bg-[#eef1f4] dark:bg-muted">
                <div className="w-[58%] rounded-md border border-border bg-card px-3 py-4 shadow-sm">
                  <div className="mb-2 h-2.5 w-2/3 rounded bg-[#9ca3af]/70" />
                  <div className="space-y-1.5">
                    <div className="h-1.5 w-full rounded bg-[#d1d5db]" />
                    <div className="h-1.5 w-[90%] rounded bg-[#d1d5db]" />
                    <div className="h-1.5 w-[80%] rounded bg-[#d1d5db]" />
                    <div className="h-1.5 w-[70%] rounded bg-[#d1d5db]" />
                  </div>
                </div>
                {part.certificateNumber ? (
                  <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-muted-foreground dark:bg-card">
                    {part.certificateNumber}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg border-border"
                  onClick={() => {
                    toast.message("Certificate replace is demo-only in this build");
                  }}
                >
                  Replace
                </Button>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <EditPartModal
        key={editOpen ? `edit-${part.id}` : "edit-closed"}
        open={editOpen}
        line={part}
        boxes={(boxes.data ?? []) as AeroBox[]}
        onClose={() => setEditOpen(false)}
        onSaved={() => setEditOpen(false)}
      />

      <UseOnJobModal
        key={useOpen ? `use-${part.id}` : "use-closed"}
        open={useOpen}
        line={part}
        boxes={(boxes.data ?? []) as AeroBox[]}
        jobs={(openJobs.data ?? []).map((j) => ({
          id: j.id,
          jobNumber: j.jobNumber,
          title: j.title,
          engineType: j.engineType,
        }))}
        currentJobId={part.jobId ?? ""}
        onClose={() => setUseOpen(false)}
        onRecorded={(jobId) => {
          setUseOpen(false);
          if (jobId) router.push(`/jobs/${jobId}`);
        }}
      />

      {boxOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setBoxOpen(false)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground">Change box</h3>
            <p className="mt-1 text-sm text-muted-foreground">{part.partNumber}</p>
            <select
              className="mt-4 flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={boxId}
              onChange={(e) => setBoxId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {(boxes.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.area ? `${b.area} — ${b.name}` : b.name}
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setBoxOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-brand text-brand-foreground hover:opacity-90"
                onClick={async () => {
                  await receiptService.changeBox(part.id, boxId || null);
                  toast.success("Box updated");
                  setBoxOpen(false);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {putBackOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPutBackOpen(false)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground">Put back in a box</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {part.partNumber} · {part.outQuantity} out with {part.assignedTo || "someone"}
            </p>
            <select
              className="mt-4 flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={boxId}
              onChange={(e) => setBoxId(e.target.value)}
            >
              <option value="">Select a box</option>
              {(boxes.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.area ? `${b.area} — ${b.name}` : b.name}
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPutBackOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-brand text-brand-foreground hover:opacity-90"
                onClick={async () => {
                  if (!boxId) {
                    toast.error("Pick a box");
                    return;
                  }
                  try {
                    await receiptService.returnToBox(part.id, boxId);
                    toast.success("Returned to box");
                    setPutBackOpen(false);
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

function HistoryEventRow({
  event,
  unit,
  selected,
  onSelect,
}: {
  event: AeroHistoryEvent;
  unit: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const jobBit = event.jobNumber || "—";
  const qtyBit = formatQtyWithUnit(event.quantity, unit);
  const primary =
    unitHint(unit) === "metres" || unitHint(unit) === "grams" || unitHint(unit) === "set"
      ? event.jobNumber
        ? `${qtyBit} · ${jobBit}`
        : qtyBit
      : `${event.quantity} · ${jobBit}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full flex-wrap items-start gap-3 border-b border-border px-4 py-3 text-left last:border-0 transition-colors ${
        selected ? "bg-[#eef4fb] dark:bg-accent" : "hover:bg-[#eef4fb] dark:hover:bg-accent"
      }`}
    >
      <div className="w-[88px] shrink-0 pt-0.5 text-[13px] tabular-nums text-muted-foreground">
        {formatHistoryStamp(event.at)}
      </div>
      <WhatBadge what={event.what} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-foreground">{primary}</div>
        {event.note ? <div className="mt-0.5 text-[13px] text-muted-foreground">{event.note}</div> : null}
      </div>
    </button>
  );
}

function QtyStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="border-b border-border px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 xl:border-b-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-[28px] font-bold leading-none tracking-tight text-foreground">{value}</div>
      <div className="mt-1.5 text-[12px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function DetailRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-[14px] font-semibold text-foreground">
        {value}
        {hint ? <span className="ml-2 font-normal text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  );
}
