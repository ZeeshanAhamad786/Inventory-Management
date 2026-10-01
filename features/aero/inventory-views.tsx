"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { lineInBoxQty } from "@/types/aeroswift";
import { formatQtyWithUnit, formatSerialOrBatch } from "@/lib/aero-format";

type ShelfLine = {
  line: AeroReceiptLine;
  inBox: number;
  boxLabel: string;
  jobNumber: string | null;
};

type ShelfGroup = {
  boxId: string;
  label: string;
  lines: ShelfLine[];
  partCount: number;
  itemCount: number;
};

function PartThumb({ partNumber }: { partNumber: string }) {
  if (partNumber === "OR-118") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-[#f3e6d8] dark:bg-muted">
        <div className="h-7 w-7 rounded-full border-[5px] border-[#c46a1a] bg-[#f6d7a8]/70 shadow-inner" />
      </div>
    );
  }
  if (partNumber === "LW-032") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-[#e8eef5] dark:bg-muted">
        <div className="h-1.5 w-7 rounded-full bg-[#64748b] shadow-sm" />
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

export function InventoryView() {
  const router = useRouter();
  const lines = useLiveQuery(() => receiptService.listInBoxes(), []);
  const boxes = useLiveQuery(() => boxService.list(), []);
  const jobs = useLiveQuery(() => jobService.list(), []);
  const openJobs = useLiveQuery(() => jobService.listOpen(), []);
  const [useLine, setUseLine] = useState<AeroReceiptLine | null>(null);
  const [changeLine, setChangeLine] = useState<AeroReceiptLine | null>(null);
  const [changeBoxId, setChangeBoxId] = useState("");

  const shelves = useMemo(() => {
    const boxRows = (boxes.data ?? []) as AeroBox[];
    const jobRows = jobs.data ?? [];
    const boxMap = new Map(boxRows.map((b) => [b.id, b.area ? `${b.area} — ${b.name}` : b.name]));
    const jobMap = new Map(jobRows.map((j) => [j.id, j.jobNumber]));
    const groups = new Map<string, ShelfGroup>();

    for (const line of lines.data ?? []) {
      const inBox = lineInBoxQty(line);
      if (inBox < 1) continue;
      const boxId = line.boxId || "unassigned";
      const label = line.boxId ? boxMap.get(line.boxId) ?? "Unknown box" : "Unassigned";
      let group = groups.get(boxId);
      if (!group) {
        group = { boxId, label, lines: [], partCount: 0, itemCount: 0 };
        groups.set(boxId, group);
      }
      group.lines.push({
        line,
        inBox,
        boxLabel: label,
        jobNumber: line.jobId ? jobMap.get(line.jobId) ?? null : null,
      });
      group.partCount += 1;
      group.itemCount += inBox;
    }

    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [boxes.data, jobs.data, lines.data]);

  if (lines.loading || boxes.loading) return <LoadingState />;
  if (lines.error) return <ErrorState message={lines.error} />;

  const totalItems = shelves.reduce((sum, s) => sum + s.itemCount, 0);
  const boxCount = shelves.length;
  const boxRows = (boxes.data ?? []) as AeroBox[];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold leading-none tracking-tight text-foreground">Inventory</h1>
          <p className="mt-2 max-w-xl text-[15px] text-muted-foreground">
            What is physically in each box, shelf by shelf.
          </p>
        </div>
        <Button type="button" variant="outline" className="h-9 rounded-lg border-border bg-card" asChild>
          <Link href="/out">See what&apos;s out with someone</Link>
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div className="text-[15px] font-semibold text-foreground">The shelves</div>
        <div className="text-[13px] text-muted-foreground">
          {totalItems} items across {boxCount} {boxCount === 1 ? "box" : "boxes"}
        </div>
      </div>

      <div className="space-y-5">
        {shelves.map((shelf) => (
          <section key={shelf.boxId} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border bg-[#f3f4f6] px-5 py-3 dark:bg-muted/50">
              <div>
                <div className="text-[15px] font-semibold text-foreground">{shelf.label}</div>
                <div className="mt-0.5 text-[13px] text-muted-foreground">
                  {shelf.partCount} {shelf.partCount === 1 ? "part" : "parts"}
                </div>
              </div>
              <div className="text-[13px] text-muted-foreground">
                {shelf.itemCount} {shelf.itemCount === 1 ? "item" : "items"} on this shelf
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3">Part</th>
                    <th className="px-5 py-3">Serial / batch</th>
                    <th className="px-5 py-3">Quantity</th>
                    <th className="px-5 py-3">Booked to</th>
                    <th className="px-5 py-3 text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {shelf.lines.map(({ line, inBox, jobNumber }) => (
                    <tr
                      key={line.id}
                      tabIndex={0}
                      className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-[#eef4fb] dark:hover:bg-accent"
                      onClick={() => router.push(`/inventory/${line.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/inventory/${line.id}`);
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
                      <td className="px-5 py-4 text-muted-foreground">{formatSerialOrBatch(line)}</td>
                      <td className="px-5 py-4 text-[18px] font-bold tabular-nums leading-none text-foreground">
                        {formatQtyWithUnit(inBox, line.unit)}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{jobNumber || "General stock"}</td>
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
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await receiptService.issueToPerson(line.id, "Stores tech", 1);
                                toast.success("Issued out with someone");
                              } catch (error) {
                                toast.error(error instanceof Error ? error.message : "Unable to issue");
                              }
                            }}
                          >
                            Issue
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded-lg border-border bg-card"
                            onClick={(e) => {
                              e.stopPropagation();
                              setChangeBoxId(line.boxId ?? "");
                              setChangeLine(line);
                            }}
                          >
                            Change box
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {shelves.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-5 py-10 text-center text-muted-foreground">
            No stock in boxes.{" "}
            <Link href="/add-parts" className="text-link hover:underline">
              Add parts
            </Link>
          </div>
        ) : null}
      </div>

      {useLine ? (
        <UseOnJobModal
          key={`inv-use-${useLine.id}`}
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

      {changeLine ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setChangeLine(null)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground">Change box</h3>
            <p className="mt-1 text-sm text-muted-foreground">{changeLine.partNumber}</p>
            <select
              className="mt-4 flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={changeBoxId}
              onChange={(e) => setChangeBoxId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {boxRows.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.area ? `${b.area} — ${b.name}` : b.name}
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setChangeLine(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-brand text-brand-foreground hover:opacity-90"
                onClick={async () => {
                  await receiptService.changeBox(changeLine.id, changeBoxId || null);
                  toast.success("Box updated");
                  setChangeLine(null);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function InventoryPartDetail({ id }: { id: string }) {
  return <PartDetailView id={id} backHref="/inventory" backLabel="Inventory" />;
}
