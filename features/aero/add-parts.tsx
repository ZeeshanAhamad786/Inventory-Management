"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, ChevronDown, FileUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLiveQuery } from "@/hooks/use-live-query";
import { jobService } from "@/services/aero/jobService";
import { boxService } from "@/services/aero/boxService";
import { receiptService } from "@/services/aero/receiptService";
import { extractFromFile, parseInvoiceText, getOcrEngineStatus } from "@/services/aero/ocrService";
import type { OcrExtractResult } from "@/types/aeroswift";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, createId } from "@/lib/utils";

type PartKind = "batch" | "serialised";

type DraftLine = {
  id: string;
  partNumber: string;
  alternativePartNumber: string;
  description: string;
  partKind: PartKind;
  unit: string;
  quantity: string;
  batchNumber: string;
  serialNumbers: string;
  costPerUnit: string;
  confidence: number | null;
};

function todayUk() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function emptyLine(): DraftLine {
  return {
    id: createId(),
    partNumber: "",
    alternativePartNumber: "",
    description: "",
    partKind: "batch",
    unit: "EA",
    quantity: "1",
    batchNumber: "",
    serialNumbers: "",
    costPerUnit: "",
    confidence: null,
  };
}

function formatUkDate(raw: string) {
  const bits = raw.replace(/-/g, "/").split("/");
  if (bits.length !== 3) return null;
  const [a, b, c] = bits;
  const year = c.length === 2 ? `20${c}` : c;
  return `${a.padStart(2, "0")}/${b.padStart(2, "0")}/${year}`;
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</span>
      {hint ? <span className="text-[11px] font-normal normal-case tracking-normal text-muted-foreground/80">{hint}</span> : null}
    </div>
  );
}

const controlClass =
  "flex h-10 w-full rounded-lg border border-border bg-card px-3 text-[14px] text-foreground shadow-none transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const compactControl =
  "flex h-9 w-full rounded-md border border-border bg-card px-2.5 text-[13px] text-foreground shadow-none transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function SelectField({
  value,
  onChange,
  options,
  className,
  disabled,
  id,
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
  disabled?: boolean;
  id?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        id={id}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(compact ? compactControl : controlClass, "appearance-none pr-9")}
      >
        {options.map((o) => (
          <option key={o.value || "__empty"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

function UploadTile({
  label,
  fileName,
  busy,
  onFile,
  accept = "image/*,.pdf,application/pdf",
  capture,
}: {
  label: string;
  fileName: string;
  busy?: boolean;
  onFile: (file: File | null) => void;
  accept?: string;
  capture?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-[108px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-[#f8fafc] px-4 py-5 text-center transition-colors hover:border-[#c5d4e8] hover:bg-[#eef4fb] dark:bg-muted/40 dark:hover:bg-accent",
        busy && "opacity-70",
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card">
        {busy ? <FileUp className="h-4 w-4 animate-pulse text-muted-foreground" /> : <Camera className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="text-[13px] font-medium text-foreground">{busy ? "Reading document…" : label}</div>
      {fileName ? <div className="max-w-full truncate text-[12px] text-muted-foreground">{fileName}</div> : null}
      <input
        type="file"
        accept={accept}
        capture={capture ? "environment" : undefined}
        className="hidden"
        disabled={busy}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function ocrGlowClass(confidence: number | null) {
  return confidence != null ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : "";
}

export function AddPartsView() {
  const router = useRouter();
  const search = useSearchParams();
  const jobs = useLiveQuery(() => jobService.listOpen(), []);
  const boxes = useLiveQuery(() => boxService.list(), []);
  const nextGr = useLiveQuery(() => receiptService.nextGrNumber(), []);

  const [dateReceived, setDateReceived] = useState(todayUk());
  const [supplierName, setSupplierName] = useState("");
  const [invoiceReference, setInvoiceReference] = useState("");
  const [salesOrder, setSalesOrder] = useState("");
  const [jobId, setJobId] = useState<string | null>(search.get("jobId"));
  const [certificateNumber, setCertificateNumber] = useState("");
  const [boxId, setBoxId] = useState<string | null>(null);
  const [newBoxText, setNewBoxText] = useState("");
  const [certFileName, setCertFileName] = useState("");
  const [partFileName, setPartFileName] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rawText, setRawText] = useState("");
  const [sourceDocumentName, setSourceDocumentName] = useState("");
  const [saving, setSaving] = useState(false);
  const [ocrEngineLabel, setOcrEngineLabel] = useState("Checking OCR…");
  const [headerFromOcr, setHeaderFromOcr] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);

  useEffect(() => {
    const fromQuery = search.get("jobId");
    if (fromQuery) setJobId(fromQuery);
  }, [search]);

  useEffect(() => {
    getOcrEngineStatus().then((s) => {
      setOcrEngineLabel(
        s.configured
          ? "Azure Document Intelligence (live)"
          : "On-device OCR (add Azure keys for UK production)",
      );
    });
  }, []);

  const jobOptions = useMemo(() => {
    const open = [...(jobs.data ?? [])].sort((a, b) => a.jobNumber.localeCompare(b.jobNumber));
    return [
      { value: "", label: "General stock — not for one job" },
      ...open.map((j) => ({
        value: j.id,
        label: `${j.jobNumber} — ${j.title}`,
      })),
    ];
  }, [jobs.data]);

  const boxOptions = useMemo(() => {
    const rows = [...(boxes.data ?? [])]
      .map((b) => ({
        value: b.id,
        label: b.area ? `${b.area} — ${b.name}` : b.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: "", label: "Select a box" }, ...rows];
  }, [boxes.data]);

  const startGr = Number(nextGr.data ?? "1") || 1;
  const previewGrs = useMemo(
    () => lines.map((_, index) => `GR${startGr + index}`),
    [lines, startGr],
  );

  function updateLine(id: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function removeLine(id: string) {
    setLines((prev) => {
      if (prev.length <= 1) return [emptyLine()];
      return prev.filter((line) => line.id !== id);
    });
  }

  function addBlankLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function applyExtract(result: OcrExtractResult, fileName?: string) {
    setWarnings(result.warnings);
    setRawText(result.rawText);
    setHeaderFromOcr(true);

    if (result.supplierName) setSupplierName(result.supplierName);
    if (result.invoiceReference) setInvoiceReference(result.invoiceReference);
    if (result.salesOrder) setSalesOrder(result.salesOrder);
    if (result.certificateNumber) setCertificateNumber(result.certificateNumber);
    if (result.date) {
      const formatted = formatUkDate(result.date);
      if (formatted) setDateReceived(formatted);
    }

    // Company GRNs are allocated on save (one per line). Ignore any GR printed on the supplier doc.
    if (result.grNumber) {
      setWarnings((prev) => [
        ...prev.filter((w) => !w.includes("supplier document GR")),
        `Supplier document mentions ${result.grNumber} — your store will still assign a new GRN per line on save.`,
      ]);
    }

    const extracted = result.lines.filter((l) => l.partNumber.trim() || l.description.trim());
    if (extracted.length) {
      setLines(
        extracted.map((line) => {
          const serialised = Boolean(line.serialNumbers?.trim());
          return {
            id: createId(),
            partNumber: line.partNumber,
            alternativePartNumber: "",
            description: line.description,
            partKind: serialised ? "serialised" : "batch",
            unit: line.unit.toUpperCase().startsWith("EA") ? "EA" : line.unit || "EA",
            quantity: serialised ? "1" : String(line.quantity || 1),
            batchNumber: serialised ? "" : line.batchNumber || "",
            serialNumbers: serialised ? line.serialNumbers : "",
            costPerUnit: "",
            confidence: line.confidence,
          } satisfies DraftLine;
        }),
      );
    } else {
      setLines([emptyLine()]);
    }

    if (fileName) setSourceDocumentName(fileName);

    const engineNote =
      result.engine === "azure"
        ? "Azure read the document"
        : result.engine === "tesseract"
          ? "On-device OCR filled fields"
          : "Fields filled from text";

    const count = extracted.length;
    toast.success(
      count
        ? `${engineNote} — ${count} line${count === 1 ? "" : "s"} ready. Review, then create ${count} GRN${count === 1 ? "" : "s"}.`
        : "Could not read line items — add rows manually",
    );
  }

  async function onCertificateFile(file: File | null) {
    if (!file) return;
    setCertFileName(file.name);
    setOcrBusy(true);
    try {
      const result = await extractFromFile(file);
      applyExtract(result, file.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read document");
    } finally {
      setOcrBusy(false);
    }
  }

  async function ensureBoxId(): Promise<string | null> {
    if (boxId) return boxId;
    const typed = newBoxText.trim();
    if (!typed) return null;
    const parts = typed.split("—").map((s) => s.trim());
    const area = parts.length > 1 ? parts[0] : "";
    const name = parts.length > 1 ? parts[1] : typed;
    const created = await boxService.create({
      name,
      code: name.replace(/\s+/g, "-").toUpperCase().slice(0, 12),
      area,
      description: "Created from Add parts",
      active: true,
    });
    setBoxId(created.id);
    return created.id;
  }

  async function onCreateGrns() {
    const usable = lines.filter((l) => l.partNumber.trim() && l.description.trim());
    if (!usable.length) {
      toast.error("Add at least one line with part number and description");
      return;
    }
    if (usable.length !== lines.length) {
      toast.error("Every line needs a part number and description — remove empty rows or fill them in");
      return;
    }

    for (const [index, line] of usable.entries()) {
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty < 1) {
        toast.error(`Line ${index + 1}: enter a valid quantity`);
        return;
      }
      if (line.partKind === "batch" && !line.batchNumber.trim()) {
        toast.error(`Line ${index + 1}: batch number is required`);
        return;
      }
      if (line.partKind === "serialised" && !line.serialNumbers.trim()) {
        toast.error(`Line ${index + 1}: serial number is required`);
        return;
      }
    }

    setSaving(true);
    try {
      const resolvedBoxId = await ensureBoxId();
      const receivedNote = dateReceived ? `Received ${dateReceived}` : "";
      const invoiceNote = invoiceReference.trim()
        ? `Invoice ${invoiceReference.trim()}`
        : "";
      const sharedNote = [receivedNote, invoiceNote].filter(Boolean).join(" · ");

      const saved = await receiptService.createMany(
        usable.map((line) => ({
          // Leave blank so allocateGrNumbers assigns one unique GRN per line
          jobId,
          partNumber: line.partNumber.trim(),
          alternativePartNumber: line.alternativePartNumber.trim(),
          description: line.description.trim(),
          quantity: line.partKind === "serialised" ? 1 : Number(line.quantity),
          unit: line.unit === "EA" || line.unit === "each" ? "EA" : line.unit,
          batchNumber: line.partKind === "batch" ? line.batchNumber.trim() : "",
          serialNumbers: line.partKind === "serialised" ? line.serialNumbers.trim() : "",
          expiryDate: "",
          condition: "NEW",
          origin: "US",
          weightKg: null,
          costPerUnit: line.costPerUnit.trim() === "" ? null : Number(line.costPerUnit),
          supplierName,
          salesOrder: salesOrder.trim(),
          certificateNumber,
          certificateOnFile: Boolean(certificateNumber.trim() || certFileName),
          customerOrder: "",
          invoiceReference,
          boxId: resolvedBoxId,
          notes: sharedNote,
          sourceDocumentName,
          ocrConfidence: line.confidence,
        })),
      );

      const grLabel = saved.map((row) => `GR${row.grNumber}`).join(", ");
      toast.success(
        saved.length === 1
          ? `Created ${grLabel} · ${saved[0].partNumber}`
          : `Created ${saved.length} GRNs from one invoice · ${grLabel}`,
      );

      setLines([emptyLine()]);
      setCertificateNumber("");
      setCertFileName("");
      setPartFileName("");
      setWarnings([]);
      setSourceDocumentName("");
      setHeaderFromOcr(false);
      setSalesOrder("");
      // Keep supplier/invoice/date for the next booking from the same delivery if useful

      if (jobId) router.push(`/jobs/${jobId}`);
      else if (saved.length === 1) router.push(`/inventory/${saved[0].id}`);
      else router.push("/inventory");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create GRNs");
    } finally {
      setSaving(false);
    }
  }

  const headerGlow = headerFromOcr ? ocrGlowClass(0.8) : "";
  const createLabel =
    lines.length <= 1 ? "Create GRN" : `Create ${lines.length} GRNs`;

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <div className="mb-7">
        <h1 className="text-[32px] font-bold leading-none tracking-tight text-foreground">Add parts</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-snug text-muted-foreground">
          Upload one invoice — every product line becomes its own GRN. Review before you save.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(260px,0.85fr)]">
        <div className="space-y-8">
          <section>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Step 1</div>
            <h2 className="text-[20px] font-bold tracking-tight text-foreground">Scan the invoice</h2>
            <p className="mt-0.5 text-[14px] text-muted-foreground">OCR fills supplier, invoice and every product line</p>
            <div className="mt-3 space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Invoice / certificate photo</FieldLabel>
                  <UploadTile label="Photograph or upload" fileName={certFileName} busy={ocrBusy} onFile={onCertificateFile} capture />
                  <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
                    One invoice with 4 products → 4 GRNs after you confirm. Always review highlighted fields.
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/90">Engine: {ocrEngineLabel}</p>
                </div>
                <div>
                  <FieldLabel hint="optional">Part photo</FieldLabel>
                  <UploadTile
                    label="Photograph or upload"
                    fileName={partFileName}
                    onFile={(file) => setPartFileName(file?.name ?? "")}
                    accept="image/*"
                    capture
                  />
                </div>
              </div>

              {warnings.length ? (
                <ul className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  {warnings.map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              ) : null}

              <details className="rounded-lg border border-border px-3 py-2">
                <summary className="cursor-pointer text-[13px] font-medium text-link">Paste invoice text instead (backup)</summary>
                <Textarea
                  className="mt-2 min-h-24"
                  placeholder="Paste text from invoice or certificate…"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
                <Button type="button" variant="outline" className="mt-2 h-9" onClick={() => applyExtract(parseInvoiceText(rawText))}>
                  Parse pasted text
                </Button>
              </details>
            </div>
          </section>

          <section>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Step 2</div>
            <h2 className="text-[20px] font-bold tracking-tight text-foreground">The delivery</h2>
            <p className="mt-0.5 text-[14px] text-muted-foreground">Shared across every GRN from this invoice</p>
            <div className="mt-3 space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <FieldLabel>Date received</FieldLabel>
                  <Input
                    value={dateReceived}
                    onChange={(e) => setDateReceived(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className={cn(controlClass, "shadow-none", headerGlow)}
                  />
                </div>
                <div>
                  <FieldLabel>Supplier</FieldLabel>
                  <Input
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className={cn(controlClass, "shadow-none", headerGlow)}
                  />
                </div>
                <div>
                  <FieldLabel>Invoice</FieldLabel>
                  <Input
                    value={invoiceReference}
                    onChange={(e) => setInvoiceReference(e.target.value)}
                    className={cn(controlClass, "shadow-none", headerGlow)}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel hint="optional">Sales order</FieldLabel>
                  <Input
                    value={salesOrder}
                    onChange={(e) => setSalesOrder(e.target.value)}
                    className={cn(controlClass, "shadow-none", headerGlow)}
                  />
                </div>
                <div>
                  <FieldLabel>Certificate reference</FieldLabel>
                  <Input
                    value={certificateNumber}
                    onChange={(e) => setCertificateNumber(e.target.value)}
                    className={cn(controlClass, "shadow-none", headerGlow)}
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Book against</FieldLabel>
                <SelectField value={jobId ?? ""} onChange={(v) => setJobId(v || null)} options={jobOptions} />
              </div>
              <div>
                <FieldLabel>Which box they go in</FieldLabel>
                <SelectField value={boxId ?? ""} onChange={(v) => setBoxId(v || null)} options={boxOptions} />
                <Input
                  className={cn(controlClass, "mt-2 shadow-none")}
                  placeholder="or type a new box, e.g. Area C — Box B"
                  value={newBoxText}
                  onChange={(e) => setNewBoxText(e.target.value)}
                />
              </div>
            </div>
          </section>

          <section>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Step 3</div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[20px] font-bold tracking-tight text-foreground">Line items → GRNs</h2>
                <p className="mt-0.5 text-[14px] text-muted-foreground">
                  {lines.length} product{lines.length === 1 ? "" : "s"} → {lines.length} GRN{lines.length === 1 ? "" : "s"} (
                  {previewGrs[0]}
                  {lines.length > 1 ? `–${previewGrs[previewGrs.length - 1]}` : ""})
                </p>
              </div>
              <Button type="button" variant="outline" className="h-9 gap-1.5" onClick={addBlankLine}>
                <Plus className="h-4 w-4" />
                Add line
              </Button>
            </div>

            <div className="mt-3 space-y-4">
              {lines.map((line, index) => {
                const glow = ocrGlowClass(line.confidence);
                return (
                  <div key={line.id} className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold tracking-wide text-foreground">
                          {previewGrs[index]}
                        </span>
                        <span className="text-[12px] text-muted-foreground">Line {index + 1}</span>
                        {line.confidence != null ? (
                          <span className="text-[11px] text-amber-700 dark:text-amber-300">
                            OCR {Math.round(line.confidence * 100)}% — review
                          </span>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeLine(line.id)}
                        aria-label={`Remove line ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <FieldLabel>Part number</FieldLabel>
                        <Input
                          value={line.partNumber}
                          onChange={(e) => updateLine(line.id, { partNumber: e.target.value })}
                          className={cn(compactControl, "shadow-none", glow)}
                        />
                      </div>
                      <div>
                        <FieldLabel>Alternative part number</FieldLabel>
                        <Input
                          value={line.alternativePartNumber}
                          onChange={(e) => updateLine(line.id, { alternativePartNumber: e.target.value })}
                          className={cn(compactControl, "shadow-none")}
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <FieldLabel>Description</FieldLabel>
                      <Input
                        value={line.description}
                        onChange={(e) => updateLine(line.id, { description: e.target.value })}
                        className={cn(compactControl, "shadow-none", glow)}
                      />
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-4">
                      <div>
                        <FieldLabel>Type</FieldLabel>
                        <SelectField
                          compact
                          value={line.partKind}
                          onChange={(v) =>
                            updateLine(line.id, {
                              partKind: v as PartKind,
                              quantity: v === "serialised" ? "1" : line.quantity,
                            })
                          }
                          options={[
                            { value: "batch", label: "Batch" },
                            { value: "serialised", label: "Serialised" },
                          ]}
                        />
                      </div>
                      <div>
                        <FieldLabel>Unit</FieldLabel>
                        <SelectField
                          compact
                          value={line.unit}
                          onChange={(v) => updateLine(line.id, { unit: v })}
                          options={[
                            { value: "EA", label: "each" },
                            { value: "metres", label: "metres" },
                            { value: "grams", label: "grams" },
                            { value: "set", label: "set" },
                          ]}
                        />
                      </div>
                      <div>
                        <FieldLabel>Qty</FieldLabel>
                        <Input
                          type="number"
                          min={1}
                          value={line.quantity}
                          disabled={line.partKind === "serialised"}
                          onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                          className={cn(compactControl, "shadow-none", glow)}
                        />
                      </div>
                      <div>
                        <FieldLabel hint="optional">£ / unit</FieldLabel>
                        <Input
                          value={line.costPerUnit}
                          onChange={(e) => updateLine(line.id, { costPerUnit: e.target.value })}
                          placeholder="—"
                          className={cn(compactControl, "shadow-none")}
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      {line.partKind === "batch" ? (
                        <>
                          <FieldLabel>Batch number</FieldLabel>
                          <Input
                            value={line.batchNumber}
                            onChange={(e) => updateLine(line.id, { batchNumber: e.target.value })}
                            className={cn(compactControl, "shadow-none", glow)}
                          />
                        </>
                      ) : (
                        <>
                          <FieldLabel>Serial number</FieldLabel>
                          <Input
                            value={line.serialNumbers}
                            onChange={(e) => updateLine(line.id, { serialNumbers: e.target.value })}
                            className={cn(compactControl, "shadow-none", glow)}
                          />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                className="h-10 rounded-lg bg-brand px-5 text-brand-foreground hover:opacity-90"
                disabled={saving || ocrBusy}
                onClick={onCreateGrns}
              >
                {saving ? "Saving…" : createLabel}
              </Button>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-[15px] font-semibold text-foreground">How this works</h3>
            <div className="mt-4 space-y-4 text-[13px] leading-relaxed text-muted-foreground">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">One line = one GRN</div>
                <p className="mt-1">
                  Standard stores booking-in: each product on the invoice gets its own GRN so batch, serial and certificate stay traceable.
                </p>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Shared delivery</div>
                <p className="mt-1">Supplier, invoice, certificate, job and box apply to every line from this upload.</p>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">OCR + review</div>
                <p className="mt-1">
                  Azure Document Intelligence (UK) when configured; otherwise on-device OCR. Amber fields came from the scan — check them before create.
                </p>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">GRN numbers</div>
                <p className="mt-1">
                  Assigned automatically on save ({previewGrs[0]}
                  {lines.length > 1 ? `–${previewGrs[previewGrs.length - 1]}` : ""}). Not taken from the supplier paperwork.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
