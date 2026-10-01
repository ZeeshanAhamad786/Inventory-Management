"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AeroBox, AeroReceiptLine } from "@/types/aeroswift";
import { lineInBoxQty } from "@/types/aeroswift";
import { receiptService } from "@/services/aero/receiptService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fieldClass =
  "h-10 rounded-md border-border bg-card text-foreground shadow-none focus-visible:ring-brand/30";

function emptyForm() {
  return {
    partNumber: "",
    alternativePartNumber: "",
    description: "",
    batchNumber: "",
    grNumber: "",
    supplierName: "",
    invoiceReference: "",
    costPerUnit: "",
    certificateNumber: "",
    certificateOnFile: true,
    quantity: "0",
    usedQuantity: "0",
    outQuantity: "0",
    assignedTo: "",
    boxId: "",
    notes: "",
  };
}

function formFromLine(line: AeroReceiptLine) {
  return {
    partNumber: line.partNumber,
    alternativePartNumber: line.alternativePartNumber ?? "",
    description: line.description,
    batchNumber: line.batchNumber,
    grNumber: line.grNumber.startsWith("GR") ? line.grNumber : `GR${line.grNumber}`,
    supplierName: line.supplierName,
    invoiceReference: line.invoiceReference,
    costPerUnit: line.costPerUnit != null ? String(line.costPerUnit) : "",
    certificateNumber: line.certificateNumber,
    certificateOnFile: line.certificateOnFile,
    quantity: String(line.quantity),
    usedQuantity: String(line.usedQuantity ?? 0),
    outQuantity: String(line.outQuantity ?? 0),
    assignedTo: line.assignedTo,
    boxId: line.boxId ?? "",
    notes: line.notes,
  };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{children}</div>;
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</span>
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function locationHelp(boxes: AeroBox[], boxId: string | null) {
  const box = boxes.find((b) => b.id === boxId);
  if (!box) return "the box";
  return box.area ? `${box.area} — ${box.name}` : box.name;
}

export function EditPartModal({
  open,
  line,
  boxes,
  onClose,
  onSaved,
}: {
  open: boolean;
  line: AeroReceiptLine | null;
  boxes: AeroBox[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => (line ? formFromLine(line) : emptyForm()));

  useEffect(() => {
    if (!open || !line) return;
    setForm(formFromLine(line));
  }, [open, line]);

  if (!open || !line) return null;

  const loc = locationHelp(boxes, form.boxId || line.boxId);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div
        className="my-4 w-full max-w-[560px] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-[22px] font-bold leading-none text-foreground">Edit part</h2>
          <p className="mt-2 text-[14px] text-muted-foreground">
            {line.partNumber} — correct the details
          </p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              const costRaw = form.costPerUnit.trim();
              await receiptService.update(line.id, {
                partNumber: form.partNumber,
                alternativePartNumber: form.alternativePartNumber,
                description: form.description,
                batchNumber: form.batchNumber,
                grNumber: form.grNumber,
                supplierName: form.supplierName,
                invoiceReference: form.invoiceReference,
                costPerUnit: costRaw === "" ? null : Number(costRaw),
                certificateNumber: form.certificateNumber,
                certificateOnFile: form.certificateOnFile,
                quantity: Number(form.quantity),
                usedQuantity: Number(form.usedQuantity),
                outQuantity: Number(form.outQuantity),
                assignedTo: form.assignedTo,
                boxId: form.boxId || null,
                notes: form.notes,
              });
              toast.success("Part updated");
              onSaved();
              onClose();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Unable to save");
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="max-h-[min(70vh,640px)] space-y-5 overflow-y-auto px-6 py-5">
            <section>
              <SectionLabel>The part</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <FieldLabel>Part number</FieldLabel>
                  <Input className={fieldClass} value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} required />
                </label>
                <label className="block">
                  <FieldLabel>Alternative part number</FieldLabel>
                  <Input className={fieldClass} value={form.alternativePartNumber} onChange={(e) => setForm({ ...form, alternativePartNumber: e.target.value })} />
                </label>
              </div>
              <label className="mt-3 block">
                <FieldLabel>Description</FieldLabel>
                <Input className={fieldClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
              </label>
              <label className="mt-3 block">
                <FieldLabel>Batch number</FieldLabel>
                <Input className={fieldClass} value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
              </label>
            </section>

            <div className="border-t border-border" />

            <section>
              <SectionLabel>The delivery</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <FieldLabel>GRN</FieldLabel>
                  <Input className={fieldClass} value={form.grNumber} onChange={(e) => setForm({ ...form, grNumber: e.target.value })} required />
                </label>
                <label className="block">
                  <FieldLabel>Supplier</FieldLabel>
                  <Input className={fieldClass} value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} />
                </label>
                <label className="block">
                  <FieldLabel>Invoice</FieldLabel>
                  <Input className={fieldClass} value={form.invoiceReference} onChange={(e) => setForm({ ...form, invoiceReference: e.target.value })} />
                </label>
              </div>
              <label className="mt-3 block">
                <FieldLabel hint="optional">Cost per unit £</FieldLabel>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className={fieldClass}
                  value={form.costPerUnit}
                  onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })}
                />
              </label>
            </section>

            <div className="border-t border-border" />

            <section>
              <SectionLabel>Certificate</SectionLabel>
              <label className="block">
                <FieldLabel>Reference</FieldLabel>
                <Input className={fieldClass} value={form.certificateNumber} onChange={(e) => setForm({ ...form, certificateNumber: e.target.value })} />
              </label>
              <div className="mt-3">
                <FieldLabel>Certificate photo</FieldLabel>
                <button
                  type="button"
                  className={`flex h-10 w-full items-center rounded-md border border-border px-3 text-left text-sm ${
                    form.certificateOnFile ? "bg-muted/50 text-foreground" : "bg-card text-muted-foreground"
                  }`}
                  onClick={() => setForm({ ...form, certificateOnFile: !form.certificateOnFile })}
                >
                  {form.certificateOnFile ? "On file — tap to remove" : "No photo — tap to mark on file"}
                </button>
              </div>
            </section>

            <div className="border-t border-border" />

            <section>
              <SectionLabel>Correct the quantities</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <FieldLabel>Total quantity</FieldLabel>
                  <Input type="number" min={0} className={fieldClass} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
                </label>
                <label className="block">
                  <FieldLabel>Used</FieldLabel>
                  <Input type="number" min={0} className={fieldClass} value={form.usedQuantity} onChange={(e) => setForm({ ...form, usedQuantity: e.target.value })} required />
                </label>
                <label className="block">
                  <FieldLabel>Out with someone</FieldLabel>
                  <Input type="number" min={0} className={fieldClass} value={form.outQuantity} onChange={(e) => setForm({ ...form, outQuantity: e.target.value })} required />
                </label>
              </div>
              {Number(form.outQuantity) > 0 ? (
                <label className="mt-3 block">
                  <FieldLabel>Who has it</FieldLabel>
                  <Input className={fieldClass} value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} placeholder="e.g. Zishan Malik" required />
                </label>
              ) : null}
              <label className="mt-3 block">
                <FieldLabel>Box</FieldLabel>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
                  value={form.boxId}
                  onChange={(e) => setForm({ ...form, boxId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {boxes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.area ? `${b.area} — ${b.name}` : b.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                Whatever is left over goes back into {loc}. Used three by mistake? Put Used back to 0 and they return to the
                box. Every correction is written to History.
              </p>
            </section>
          </div>

          <div className="flex justify-end gap-2 border-t border-border bg-muted/60 px-6 py-4">
            <Button type="button" variant="outline" className="rounded-lg border-border bg-card text-foreground" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="rounded-lg bg-brand text-brand-foreground hover:opacity-90">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function UseOnJobModal({
  open,
  line,
  boxes,
  jobs,
  currentJobId,
  onClose,
  onRecorded,
}: {
  open: boolean;
  line: AeroReceiptLine | null;
  boxes: AeroBox[];
  jobs: Array<{ id: string; jobNumber: string; title: string; engineType: string }>;
  currentJobId: string;
  onClose: () => void;
  onRecorded: (jobId: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [jobId, setJobId] = useState(currentJobId);
  const [qty, setQty] = useState("1");
  const [wentOn, setWentOn] = useState(() => line?.notes?.split("\n").filter(Boolean).pop() ?? "");

  useEffect(() => {
    if (!open || !line) return;
    setJobId(currentJobId);
    setQty("1");
    setWentOn(line.notes?.split("\n").filter(Boolean).pop() ?? "");
  }, [open, line, currentJobId]);

  if (!open || !line) return null;

  const inBox = lineInBoxQty(line);
  const box = boxes.find((b) => b.id === line.boxId);
  const boxLabel = box ? (box.area ? `${box.area} — ${box.name}` : box.name) : "Unassigned";
  const available = inBox + line.outQuantity;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[480px] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-[22px] font-bold leading-none text-foreground">Use on a job</h2>
          <p className="mt-2 text-[14px] text-muted-foreground">
            {line.partNumber} — {line.description}
          </p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              await receiptService.useOnJob(line.id, Number(qty), wentOn, jobId);
              toast.success("Part recorded as used");
              onRecorded(jobId);
              onClose();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Unable to record");
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="space-y-4 px-6 py-5">
            <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm">
              <span className="text-muted-foreground">In the box</span>
              <span className="font-medium text-foreground">
                {inBox} · {boxLabel}
              </span>
            </div>

            <label className="block">
              <FieldLabel>Which job</FieldLabel>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                required
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.jobNumber} — {j.title} · {j.engineType}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <FieldLabel>Quantity</FieldLabel>
              <Input
                type="number"
                min={1}
                max={available}
                className={fieldClass}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </label>

            <label className="block">
              <FieldLabel>What it went on</FieldLabel>
              <textarea
                className="min-h-[88px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-none outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                value={wentOn}
                onChange={(e) => setWentOn(e.target.value)}
                placeholder="e.g. Fitted to LP case split line"
              />
            </label>

            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Taken from the box first, then anything out with someone. You land on the job afterwards.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-6 py-4">
            <Button type="button" variant="outline" className="rounded-lg border-border bg-card text-foreground" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || available < 1}
              className="rounded-lg bg-brand text-brand-foreground hover:opacity-90"
            >
              {saving ? "Recording…" : "Record it"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
