"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, ChevronDown, FileUp } from "lucide-react";
import { toast } from "sonner";
import { useLiveQuery } from "@/hooks/use-live-query";
import { jobService } from "@/services/aero/jobService";
import { boxService } from "@/services/aero/boxService";
import { receiptService } from "@/services/aero/receiptService";
import { extractFromFile, parseInvoiceText, getOcrEngineStatus } from "@/services/aero/ocrService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PartKind = "batch" | "serialised";

function todayUk() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
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

function SelectField({
  value,
  onChange,
  options,
  className,
  disabled,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        id={id}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(controlClass, "appearance-none pr-10")}
      >
        {options.map((o) => (
          <option key={o.value || "__empty"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
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

export function AddPartsView() {
  const router = useRouter();
  const search = useSearchParams();
  const jobs = useLiveQuery(() => jobService.listOpen(), []);
  const boxes = useLiveQuery(() => boxService.list(), []);
  const nextGr = useLiveQuery(() => receiptService.nextGrNumber(), []);

  const [grNumber, setGrNumber] = useState("");
  const [dateReceived, setDateReceived] = useState(todayUk());
  const [supplierName, setSupplierName] = useState("");
  const [invoiceReference, setInvoiceReference] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [jobId, setJobId] = useState<string | null>(search.get("jobId"));

  const [partNumber, setPartNumber] = useState("");
  const [alternativePartNumber, setAlternativePartNumber] = useState("");
  const [description, setDescription] = useState("");
  const [partKind, setPartKind] = useState<PartKind>("batch");
  const [unit, setUnit] = useState("EA");
  const [quantity, setQuantity] = useState("1");
  const [batchNumber, setBatchNumber] = useState("");
  const [serialNumbers, setSerialNumbers] = useState("");

  const [certificateNumber, setCertificateNumber] = useState("");
  const [boxId, setBoxId] = useState<string | null>(null);
  const [newBoxText, setNewBoxText] = useState("");
  const [certFileName, setCertFileName] = useState("");
  const [partFileName, setPartFileName] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rawText, setRawText] = useState("");
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [sourceDocumentName, setSourceDocumentName] = useState("");
  const [saving, setSaving] = useState(false);
  const [ocrEngineLabel, setOcrEngineLabel] = useState("Checking OCR…");

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

  useEffect(() => {
    if (!grNumber && nextGr.data) setGrNumber(`GR${nextGr.data}`);
  }, [grNumber, nextGr.data]);

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

  function applyExtract(result: ReturnType<typeof parseInvoiceText>, fileName?: string) {
    setWarnings(result.warnings);
    setRawText(result.rawText);
    if (result.grNumber) setGrNumber(result.grNumber);
    if (result.supplierName) setSupplierName(result.supplierName);
    if (result.invoiceReference) setInvoiceReference(result.invoiceReference);
    if (result.certificateNumber) setCertificateNumber(result.certificateNumber);
    if (result.date) {
      const bits = result.date.replace(/-/g, "/").split("/");
      if (bits.length === 3) {
        const [a, b, c] = bits;
        const year = c.length === 2 ? `20${c}` : c;
        setDateReceived(`${a.padStart(2, "0")}/${b.padStart(2, "0")}/${year}`);
      }
    }
    const line = result.lines[0];
    if (line) {
      if (line.partNumber) setPartNumber(line.partNumber);
      if (line.description) setDescription(line.description);
      if (line.quantity) setQuantity(String(line.quantity));
      if (line.unit) setUnit(line.unit.toUpperCase().startsWith("EA") ? "EA" : line.unit);
      if (line.batchNumber) {
        setPartKind("batch");
        setBatchNumber(line.batchNumber);
      }
      if (line.serialNumbers) {
        setPartKind("serialised");
        setSerialNumbers(line.serialNumbers);
        setQuantity("1");
      }
      setOcrConfidence(line.confidence);
    } else {
      setOcrConfidence(null);
    }
    if (fileName) setSourceDocumentName(fileName);
    const engineNote =
      result.engine === "azure"
        ? "Azure read the document"
        : result.engine === "tesseract"
          ? "On-device OCR filled fields"
          : "Fields filled from text";
    toast.success(
      result.lines.length || result.supplierName || result.invoiceReference
        ? `${engineNote} — review highlighted fields, then Add part`
        : "Could not read much — complete fields manually",
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

  async function onAddPart() {
    if (!partNumber.trim() || !description.trim()) {
      toast.error("Part number and description are required");
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (partKind === "batch" && !batchNumber.trim()) {
      toast.error("Batch number is required for batch parts");
      return;
    }
    if (partKind === "serialised" && !serialNumbers.trim()) {
      toast.error("Serial number is required for serialised parts");
      return;
    }

    setSaving(true);
    try {
      const resolvedBoxId = await ensureBoxId();
      const gr = grNumber.replace(/^GR/i, "").trim() || undefined;
      const saved = await receiptService.createMany([
        {
          grNumber: gr,
          jobId,
          partNumber: partNumber.trim(),
          alternativePartNumber: alternativePartNumber.trim(),
          description: description.trim(),
          quantity: partKind === "serialised" ? 1 : qty,
          unit: unit === "EA" || unit === "each" ? "EA" : unit,
          batchNumber: partKind === "batch" ? batchNumber.trim() : "",
          serialNumbers: partKind === "serialised" ? serialNumbers.trim() : "",
          expiryDate: "",
          condition: "NEW",
          origin: "US",
          weightKg: null,
          costPerUnit: costPerUnit.trim() === "" ? null : Number(costPerUnit),
          supplierName,
          salesOrder: "",
          certificateNumber,
          certificateOnFile: Boolean(certificateNumber.trim() || certFileName),
          customerOrder: "",
          invoiceReference,
          boxId: resolvedBoxId,
          notes: dateReceived ? `Received ${dateReceived}` : "",
          sourceDocumentName,
          ocrConfidence,
        },
      ]);
      toast.success(`Added ${saved[0].partNumber} · GR${saved[0].grNumber}`);
      setPartNumber("");
      setAlternativePartNumber("");
      setDescription("");
      setQuantity("1");
      setBatchNumber("");
      setSerialNumbers("");
      setCertificateNumber("");
      setCertFileName("");
      setPartFileName("");
      setOcrConfidence(null);
      setWarnings([]);
      setSourceDocumentName("");
      setGrNumber("");
      if (jobId) router.push(`/jobs/${jobId}`);
      else router.push(`/inventory/${saved[0].id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add part");
    } finally {
      setSaving(false);
    }
  }

  const ocrGlow = ocrConfidence != null ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : "";

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <div className="mb-7">
        <h1 className="text-[32px] font-bold leading-none tracking-tight text-foreground">Add parts</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-snug text-muted-foreground">
          Book in what arrived. One line per part — the GRN, supplier and certificate stay with it for good.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(260px,0.85fr)]">
        <div className="space-y-8">
          <section>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Step 1</div>
            <h2 className="text-[20px] font-bold tracking-tight text-foreground">The delivery</h2>
            <p className="mt-0.5 text-[14px] text-muted-foreground">Where it came from</p>
            <div className="mt-3 space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <FieldLabel>GRN</FieldLabel>
                  <Input value={grNumber} onChange={(e) => setGrNumber(e.target.value)} className={cn(controlClass, "shadow-none")} />
                </div>
                <div>
                  <FieldLabel>Date received</FieldLabel>
                  <Input
                    value={dateReceived}
                    onChange={(e) => setDateReceived(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className={cn(controlClass, "shadow-none")}
                  />
                </div>
                <div>
                  <FieldLabel>Supplier</FieldLabel>
                  <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={cn(controlClass, "shadow-none", ocrGlow)} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1.45fr_1fr]">
                <div>
                  <FieldLabel>Invoice</FieldLabel>
                  <Input value={invoiceReference} onChange={(e) => setInvoiceReference(e.target.value)} className={cn(controlClass, "shadow-none", ocrGlow)} />
                </div>
                <div>
                  <FieldLabel hint="optional">Cost per unit £</FieldLabel>
                  <Input
                    value={costPerUnit}
                    onChange={(e) => setCostPerUnit(e.target.value)}
                    placeholder="leave blank"
                    className={cn(controlClass, "shadow-none")}
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Book against</FieldLabel>
                <SelectField value={jobId ?? ""} onChange={(v) => setJobId(v || null)} options={jobOptions} />
              </div>
            </div>
          </section>

          <section>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Step 2</div>
            <h2 className="text-[20px] font-bold tracking-tight text-foreground">The part</h2>
            <p className="mt-0.5 text-[14px] text-muted-foreground">What it is and how many</p>
            <div className="mt-3 space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Part number</FieldLabel>
                  <Input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} className={cn(controlClass, "shadow-none", ocrGlow)} />
                </div>
                <div>
                  <FieldLabel>Alternative part number</FieldLabel>
                  <Input
                    value={alternativePartNumber}
                    onChange={(e) => setAlternativePartNumber(e.target.value)}
                    className={cn(controlClass, "shadow-none")}
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Description</FieldLabel>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} className={cn(controlClass, "shadow-none", ocrGlow)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <FieldLabel>Part type</FieldLabel>
                  <SelectField
                    value={partKind}
                    onChange={(v) => setPartKind(v as PartKind)}
                    options={[
                      { value: "batch", label: "Batch" },
                      { value: "serialised", label: "Serialised" },
                    ]}
                  />
                </div>
                <div>
                  <FieldLabel>Unit</FieldLabel>
                  <SelectField
                    value={unit}
                    onChange={setUnit}
                    options={[
                      { value: "EA", label: "each" },
                      { value: "metres", label: "metres" },
                      { value: "grams", label: "grams" },
                      { value: "set", label: "set" },
                    ]}
                  />
                </div>
                <div>
                  <FieldLabel>Total quantity</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    disabled={partKind === "serialised"}
                    onChange={(e) => setQuantity(e.target.value)}
                    className={cn(controlClass, "shadow-none", ocrGlow)}
                  />
                </div>
              </div>
              {partKind === "batch" ? (
                <div>
                  <FieldLabel>Batch number</FieldLabel>
                  <Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className={cn(controlClass, "shadow-none", ocrGlow)} />
                </div>
              ) : (
                <div>
                  <FieldLabel>Serial number</FieldLabel>
                  <Input value={serialNumbers} onChange={(e) => setSerialNumbers(e.target.value)} className={cn(controlClass, "shadow-none", ocrGlow)} />
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Step 3</div>
            <h2 className="text-[20px] font-bold tracking-tight text-foreground">Paperwork and photos</h2>
            <p className="mt-0.5 text-[14px] text-muted-foreground">Add them now or later — nothing is blocked</p>
            <div className="mt-3 space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div>
                <FieldLabel>Certificate reference</FieldLabel>
                <Input
                  value={certificateNumber}
                  onChange={(e) => setCertificateNumber(e.target.value)}
                  className={cn(controlClass, "shadow-none", ocrGlow)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Certificate photo</FieldLabel>
                  <UploadTile label="Photograph or upload" fileName={certFileName} busy={ocrBusy} onFile={onCertificateFile} capture />
                  <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
                    Photo/scan of invoice or certificate auto-fills GRN, supplier, invoice, part and certificate. Always review before saving.
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

              <div>
                <FieldLabel>Which box it goes in</FieldLabel>
                <SelectField value={boxId ?? ""} onChange={(v) => setBoxId(v || null)} options={boxOptions} />
                <Input
                  className={cn(controlClass, "mt-2 shadow-none")}
                  placeholder="or type a new box, e.g. Area C — Box B"
                  value={newBoxText}
                  onChange={(e) => setNewBoxText(e.target.value)}
                />
              </div>

              <div className="flex justify-end border-t border-border pt-4">
                <Button
                  type="button"
                  className="h-10 rounded-lg bg-brand px-5 text-brand-foreground hover:opacity-90"
                  disabled={saving || ocrBusy}
                  onClick={onAddPart}
                >
                  {saving ? "Saving…" : "Add part"}
                </Button>
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-[15px] font-semibold text-foreground">How this works</h3>
            <div className="mt-4 space-y-4 text-[13px] leading-relaxed text-muted-foreground">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Jobs or general stock</div>
                <p className="mt-1">Book a part to a job, or into general stock if any engine might need it.</p>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Certificates</div>
                <p className="mt-1">
                  Photograph or upload the invoice/certificate. Azure Document Intelligence (UK) reads it when configured; otherwise on-device OCR is used. You confirm before save.
                </p>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Serialised vs batch</div>
                <p className="mt-1">Serialised takes one serial and quantity one. Batch takes a batch number and a quantity.</p>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Editing later</div>
                <p className="mt-1">Open any part to edit or delete it. Changes stay in History.</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
