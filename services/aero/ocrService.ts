import type { OcrExtractResult, OcrExtractedLine, PartCondition } from "@/types/aeroswift";

const PART_PATTERN = /\b([A-Z]{1,6}[-/]?(?:[A-Z0-9]+[-/]?)+[A-Z0-9]|MS\d{4,}[-A-Z0-9]*|NAS\d+[A-Z0-9-]*|AN\d+[-A-Z0-9]*|SL[-A-Z0-9]+|LW[-A-Z0-9]+|RS[-A-Z0-9]+|OR[-A-Z0-9]+|BH[-A-Z0-9]+|BRG[-A-Z0-9]+|NUT[-A-Z0-9]+)\b/g;
const QTY_PATTERN = /\b(\d{1,5})\s*(EA|EACH|PCS?|PK(?:-\d+)?|metres?|meters?|grams?|set)\b/gi;
const BATCH_PATTERN = /\b(?:Batch(?:\s*No)?[:\s]*|A|C|B)(\d{5,}|[A-Z]?\d{5,})\b/gi;
const SERIAL_PATTERN = /\b(?:Serial\s*No(?:\(s\))?\.?[:\s]*)([A-Z0-9,\s/-]+)/i;
const ORDER_PATTERN = /\b(?:Sales\s*Order|SO)[:\s#]*([A-Z0-9-]+)/i;
const CERT_PATTERN = /\b(?:Certificate|Cert(?:ificate)?\s*No\.?)[:\s#]*([0-9]{6,}|[A-Z]{1,3}-?\d{4,})\b/i;
const CUST_ORDER_PATTERN = /\b(?:Customer\s*Order\s*No\.?|Your\s*Order)[:\s#]*([A-Za-z0-9-]+)/i;
const DATE_PATTERN = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/;
const WEIGHT_PATTERN = /\b(\d+\.\d{2,6})\s*(?:Kg|KG)?\b/;
const GRN_PATTERN = /\bGRN?\s*[:#-]?\s*(?:GR)?(\d{3,6})\b/i;

function normalizeCondition(text: string): PartCondition {
  const upper = text.toUpperCase();
  if (upper.includes("OVERHAUL")) return "Overhauled";
  if (upper.includes("REPAIR")) return "Repaired";
  if (upper.includes("USED")) return "Used";
  if (upper.includes("NEW")) return "NEW";
  return "NEW";
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

/** Parse OCR / pasted invoice text into GRN header + line suggestions */
export function parseInvoiceText(rawText: string): OcrExtractResult {
  const text = rawText.replace(/\r/g, "\n");
  const warnings: string[] = [];
  const upper = text.toUpperCase();

  let supplierName = "";
  if (upper.includes("ADAMS AVIATION")) supplierName = "Adams Aviation";
  else if (upper.includes("SATAIR")) supplierName = "Satair UK";
  else if (upper.includes("AVIALL")) supplierName = "Aviall Services";
  else if (upper.includes("SUPERIOR AIR PARTS")) supplierName = "Superior Air Parts";
  else if (upper.includes("LYCOMING")) supplierName = "Lycoming Engines";
  else if (upper.includes("CONTINENTAL")) supplierName = "Continental Aerospace";
  else if (upper.includes("AIRPART") || upper.includes("AIR PART")) supplierName = "Airpart";

  const salesOrder = text.match(ORDER_PATTERN)?.[1] ?? "";
  const certificateNumber =
    text.match(CERT_PATTERN)?.[1] ??
    text.match(/\b(?:Cert(?:ificate)?(?:\s*Ref(?:erence)?)?|ST)[:\s#-]*([A-Z0-9-]{5,})\b/i)?.[1] ??
    "";
  const customerOrder = text.match(CUST_ORDER_PATTERN)?.[1] ?? "";
  const date = text.match(DATE_PATTERN)?.[1] ?? "";
  const invoiceMatch = text.match(/\b(?:Invoice|INV)[:\s#-]*([A-Z0-9-]+)/i)?.[1] ?? "";
  const invoiceReference = invoiceMatch || salesOrder || certificateNumber;
  const grDigits = text.match(GRN_PATTERN)?.[1];
  const grNumber = grDigits ? `GR${grDigits}` : undefined;

  const partMatches = uniqueStrings([...(text.toUpperCase().match(PART_PATTERN) ?? [])]).filter(
    (p) =>
      p.length >= 4 &&
      !["PAGE", "DATE", "ITEM", "BATCH", "ORIGIN", "CONDITION", "SATAIR", "AVIALL", "ADAMS", "INVOICE", "CERTIFICATE", "SERIAL", "NUMBER"].includes(p) &&
      !/^(INV|GR|ST|SO)[-_]?\d*$/i.test(p),
  );

  const qtyMatches = [...text.matchAll(QTY_PATTERN)].map((m) => {
    const unitRaw = (m[2] || "EA").toLowerCase();
    let unit = "EA";
    if (unitRaw.startsWith("ea") || unitRaw.startsWith("pc")) unit = "EA";
    else if (unitRaw.startsWith("metre") || unitRaw.startsWith("meter")) unit = "metres";
    else if (unitRaw.startsWith("gram")) unit = "grams";
    else if (unitRaw.startsWith("set")) unit = "set";
    else unit = m[2].toUpperCase();
    return { qty: Number(m[1]), unit };
  });

  const batchMatches = uniqueStrings(
    [...text.matchAll(BATCH_PATTERN)].map((m) => (m[0].match(/[ACB]?\d{5,}/i)?.[0] ?? m[1] ?? "").toUpperCase()),
  );

  const serialBlock = text.match(SERIAL_PATTERN)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const condition = normalizeCondition(text);
  const origin = /\bUS\b/.test(upper) ? "US" : /\bUK\b/.test(upper) ? "UK" : "";
  const weightMatch = text.match(WEIGHT_PATTERN);
  const weightKg = weightMatch ? Number(weightMatch[1]) : null;

  const lines: OcrExtractedLine[] = [];

  if (partMatches.length === 0) {
    warnings.push("No part numbers detected. Check image clarity or enter lines manually.");
  }

  const count = Math.max(partMatches.length, 1);
  for (let i = 0; i < count; i += 1) {
    const partNumber = partMatches[i] ?? "";
    const qtyInfo = qtyMatches[i] ?? qtyMatches[0] ?? { qty: 1, unit: "EA" };
    const descriptionLine =
      text
        .split("\n")
        .map((l) => l.trim())
        .find((l) => partNumber && l.toUpperCase().includes(partNumber) && l.length > partNumber.length + 3) ??
      "";
    const description =
      descriptionLine
        .replace(new RegExp(partNumber, "i"), "")
        .replace(/\b\d+\s*EA\b/i, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || (partNumber ? `Part ${partNumber}` : "Review description");

    lines.push({
      partNumber,
      description,
      quantity: Number.isFinite(qtyInfo.qty) && qtyInfo.qty > 0 ? qtyInfo.qty : 1,
      unit: qtyInfo.unit || "EA",
      batchNumber: batchMatches[i] ?? batchMatches[0] ?? "",
      serialNumbers: i === 0 ? serialBlock : "",
      expiryDate: "",
      condition,
      origin,
      weightKg: i === 0 ? weightKg : null,
      confidence: partNumber ? 0.72 : 0.35,
    });
  }

  if (!supplierName) warnings.push("Supplier not detected — fill manually.");
  if (!salesOrder && !certificateNumber) warnings.push("Sales order / certificate not found in text.");

  return {
    supplierName,
    salesOrder,
    certificateNumber,
    customerOrder,
    invoiceReference,
    date,
    grNumber,
    rawText: text,
    lines: lines.filter((l) => l.partNumber || l.description),
    warnings,
    engine: "paste",
  };
}

async function extractViaAzureApi(file: File): Promise<OcrExtractResult | null> {
  try {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/ocr/extract", { method: "POST", body });
    if (res.status === 503 || res.status === 502) {
      // Cloud not configured or failed — caller falls back
      return null;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `OCR API error ${res.status}`);
    }
    return (await res.json()) as OcrExtractResult;
  } catch {
    return null;
  }
}

export async function extractFromImage(file: File): Promise<OcrExtractResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    const parsed = parseInvoiceText(text || "");
    parsed.engine = "tesseract";
    if (!text.trim()) {
      parsed.warnings.unshift("OCR returned empty text. Try a clearer photo or PDF page.");
    } else {
      parsed.warnings.unshift("Read on-device (Tesseract). For UK production accuracy, configure Azure Document Intelligence.");
    }
    return parsed;
  } finally {
    await worker.terminate();
  }
}

/**
 * Prefer Azure Document Intelligence (server) for real invoices.
 * Falls back to on-device Tesseract if Azure is not configured.
 */
export async function extractFromFile(file: File): Promise<OcrExtractResult> {
  // Always try cloud first when available (images + PDFs)
  const cloud = await extractViaAzureApi(file);
  if (cloud) return cloud;

  const type = file.type.toLowerCase();
  if (type.includes("pdf")) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const asString = new TextDecoder("latin1").decode(bytes);
    const matches = asString.match(/\((?:\\.|[^\\)]){3,80}\)/g) ?? [];
    const embedded = matches
      .map((m) => m.slice(1, -1).replace(/\\n/g, "\n").replace(/\\(.)/g, "$1"))
      .join("\n");
    if (embedded.replace(/\s/g, "").length > 40) {
      const parsed = parseInvoiceText(embedded);
      parsed.engine = "pdf-text";
      parsed.warnings.push("PDF text extracted locally. Configure Azure for scanned PDF pages.");
      return parsed;
    }
    return {
      supplierName: "",
      salesOrder: "",
      certificateNumber: "",
      customerOrder: "",
      invoiceReference: "",
      date: "",
      rawText: "",
      lines: [],
      warnings: [
        "Scanned PDF needs Azure Document Intelligence, or photograph one page as JPG/PNG.",
      ],
      engine: "pdf-text",
    };
  }

  return extractFromImage(file);
}

export async function getOcrEngineStatus(): Promise<{ configured: boolean; engine: string }> {
  try {
    const res = await fetch("/api/ocr/extract");
    if (!res.ok) return { configured: false, engine: "tesseract-fallback" };
    return (await res.json()) as { configured: boolean; engine: string };
  } catch {
    return { configured: false, engine: "tesseract-fallback" };
  }
}
