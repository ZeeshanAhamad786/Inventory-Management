import type { OcrExtractResult, OcrExtractedLine, PartCondition } from "@/types/aeroswift";

const SERIAL_PATTERN = /\b(?:Serial\s*No(?:\(s\))?\.?[:\s]*)([A-Z0-9,\s/-]+)/i;
const ORDER_PATTERN = /\b(?:Sales\s*Order|SO)[:\s#]*([A-Z0-9-]+)/i;
const CERT_PATTERN =
  /\b(?:Certificate|Cert)\s*(?:No|Number|Ref(?:erence)?)?\.?\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]{4,})\b/i;
const CUST_ORDER_PATTERN = /\b(?:Customer\s*Order\s*No\.?|Your\s*Order)[:\s#]*([A-Za-z0-9-]+)/i;
const DATE_PATTERN = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/;
const WEIGHT_PATTERN = /\b(\d+\.\d{2,6})\s*(?:Kg|KG)?\b/;
const GRN_PATTERN = /\bGRN?\s*[:#-]?\s*(?:GR)?(\d{3,6})\b/i;
const DOC_REF_PATTERN = /\b(GR\d{3,6}[-–]\d{3,6})\b/i;

/** Words that look like “part numbers” to a loose regex but never are */
const PART_DENYLIST = new Set(
  [
    "PAGE", "DATE", "ITEM", "BATCH", "ORIGIN", "CONDITION", "SATAIR", "AVIALL", "ADAMS", "INVOICE",
    "CERTIFICATE", "SERIAL", "NUMBER", "SOLD", "SHIP", "AVIATION", "SUPPLY", "HOUSE", "WORLDWIDE",
    "KELVIN", "LANE", "ALGONQUIN", "ROAD", "NEWTON", "PALATINE", "CRAWLEY", "REMAINING",
    "DESCRIPTION", "ORDERED", "UNIT", "DELIVERED", "QUANTITY", "GUIDE", "RING", "SINGLE", "CYLINDER",
    "GASKET", "BEARING", "CONNECTING", "CRANKSHAFT", "THRUST", "WASHER", "TOTAL", "PIECES", "PIECE",
    "PMA", "PART", "YES", "NO", "SUPERIOR", "FEDERAL", "SYSTEM", "ORDER", "PRODUCTS", "CONFORMANCE",
    "CERTIFICATE", "LIFTER", "BODY", "ROD", "SET", "HYD", "PK", "EACH", "TRUE", "FALSE", "JOB",
    "TELEPHONE", "FAX", "CO", "LTD", "INC", "USA", "UK", "TOTAL", "QUANITY", "QUANTTY", "BATEN",
    "NUMOER", "NUMPER", "ATCH", "TOTA", "PECES", "PRECES", "PACES", "GASEER", "GASAR", "LFTER",
    "HEREBY", "CONFORM", "APPLICABLE", "PARTS", "PARS", "STAD", "THIS", "REQURAMENTS", "NAPBCHON",
    "ADMIAAATON", "AEROPIA", "SHIPMENT", "PACKING", "DELIVERY", "CUSTOMER", "VENDOR", "ADDRESS",
    "SAS484", "SASS", "SIS9TES", "VES", "VESGASKET",
  ].map((s) => s.toUpperCase()),
);

const AVIATION_PREFIXES = ["SA", "SL", "LW", "RS", "OR", "BH", "BRG", "NUT", "MS", "NAS", "AN", "STD"];

function normalizeCondition(text: string): PartCondition {
  const upper = text.toUpperCase();
  if (upper.includes("OVERHAUL")) return "Overhauled";
  if (upper.includes("REPAIR")) return "Repaired";
  if (upper.includes("USED")) return "Used";
  if (upper.includes("NEW")) return "NEW";
  return "NEW";
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Fix common Tesseract misreads on aviation packing lists */
export function normalizeOcrText(raw: string): string {
  let text = raw.replace(/\r/g, "\n");

  text = text
    .replace(/numoer|numper|numbber/gi, "number")
    .replace(/Baten\s*number/gi, "Batch number")
    .replace(/Batch\s*number/gi, "Batch number")
    .replace(/B+atch\s*number/gi, "Batch number")
    .replace(/Quan[il1]ty|Quantty|Quanity/gi, "Quantity")
    .replace(/Tota[l1]\s*pe[cç]es|Total\s*preces|Total\s*paces/gi, "Total pieces")
    .replace(/pe[cç]es|preces|paces/gi, "pieces")
    .replace(/Gaseer|Gasar/gi, "GASKET")
    .replace(/30DY\s*HYD\s*LFTER|BODY\s*HYD\s*LFTER/gi, "BODY HYD LIFTER")
    .replace(/RING\s*SET\s*SINGLE\s*CYLINDER/gi, "RING SET SINGLE CYLINDER")
    .replace(/CERTIFICATE\s*OF\s*CONFORMANCE/gi, "CERTIFICATE OF CONFORMANCE");

  // Leading $ / 5 often misread as S on SA*/SL* part numbers
  text = text.replace(/(^|[^A-Z0-9])[\$5](A[\dA-Z])/gim, "$1S$2");
  text = text.replace(/(^|[^A-Z0-9])[\$5](L[\dA-Z])/gim, "$1S$2");
  // SAS30851 → SA530851 (extra S after SA)
  text = text.replace(/\bSAS(\d{5,})\b/gi, "SA5$1");
  // Dot used instead of hyphen in part numbers: SA10205.1 → SA10205-1
  text = text.replace(/\b(SA\d+)\.(\d)\b/gi, "$1-$2");
  // Spaced SC modifier: SA2000 SC P15 → SA2000-SC P15
  text = text.replace(/\b(SA\d+)\s+SC\s+P?(\d{2,4})\b/gi, "$1-SC P$2");
  text = text.replace(/\b(SA\d+)\s+SC\b/gi, "$1-SC");
  // Batch numbers with space/dot instead of hyphen
  text = text.replace(/\b(\d{6})[\s.]+(\d{6,9})\b/g, "$1-$2");
  // Filename / doc refs: GRO65-1046 → GR965-1046 (O/0 misread as from 9)
  text = text.replace(/\bGR[O0](\d{2,5})[-–](\d{3,6})\b/gi, "GR9$1-$2");
  // P020 misread as 2020 next to SA* item numbers
  text = text.replace(/\b(SA[A-Z0-9-]+)\s+20(\d{2})\b/gi, "$1 P$2");
  // M008 / M005 common OCR collapses
  text = text.replace(/\bMOS\b/g, "M008").replace(/\bMOOS\b/g, "M005");

  return text;
}

function isDeniedPart(token: string) {
  const upper = token.toUpperCase().replace(/\s+/g, "");
  if (PART_DENYLIST.has(upper)) return true;
  if (PART_DENYLIST.has(token.toUpperCase())) return true;
  if (!/\d/.test(token)) return true; // aviation PNs almost always contain digits
  if (token.length < 5) return true;
  return false;
}

function looksLikeAviationPart(token: string) {
  const t = token.toUpperCase().trim();
  if (isDeniedPart(t)) return false;
  return AVIATION_PREFIXES.some((prefix) => t.startsWith(prefix) && t.length >= 5);
}

function partCanonicalKey(partNumber: string) {
  return partNumber
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/P0+(\d+)/g, "P$1")
    .replace(/M0+(\d+)/g, "M$1")
    .replace(/-/g, "");
}

function digitsCore(partNumber: string) {
  const digits = partNumber.toUpperCase().replace(/\s+[PM]\d+.*/i, "").replace(/\D/g, "");
  return digits.slice(-5);
}

function mergeDuplicateParts(parts: FoundPart[], text: string): FoundPart[] {
  const merged: FoundPart[] = [];
  for (const part of parts) {
    const key = partCanonicalKey(part.partNumber);
    const core = digitsCore(part.partNumber);
    const prev = merged[merged.length - 1];
    const overlapIdx = merged.findIndex(
      (p) =>
        partCanonicalKey(p.partNumber) === key ||
        (core.length >= 5 && digitsCore(p.partNumber) === core && Math.abs(p.index - part.index) < 160),
    );

    if (overlapIdx >= 0) {
      const existing = merged[overlapIdx];
      const prevBlock = text.slice(existing.index, existing.index + 260);
      const block = text.slice(part.index, part.index + 260);
      const prevHasBatch = /Batch\s*number/i.test(prevBlock);
      const hasBatch = /Batch\s*number/i.test(block);
      const preferNew =
        (hasBatch && !prevHasBatch) ||
        (hasBatch === prevHasBatch && part.partNumber.length > existing.partNumber.length);
      if (preferNew) {
        merged[overlapIdx] = {
          ...part,
          // Keep earliest OCR hit so description on the row above remains in lookback range
          index: Math.min(existing.index, part.index),
        };
      } else {
        merged[overlapIdx] = {
          ...existing,
          index: Math.min(existing.index, part.index),
        };
      }
      continue;
    }

    if (prev && Math.abs(part.index - prev.index) < 80) {
      const prevKey = partCanonicalKey(prev.partNumber);
      if (key === prevKey || key.startsWith(prevKey) || prevKey.startsWith(key)) {
        const prevBlock = text.slice(prev.index, prev.index + 220);
        const block = text.slice(part.index, part.index + 220);
        const prevHasBatch = /Batch\s*number/i.test(prevBlock);
        const hasBatch = /Batch\s*number/i.test(block);
        if (hasBatch && !prevHasBatch) merged[merged.length - 1] = part;
        else if (part.partNumber.length > prev.partNumber.length && !(prevHasBatch && !hasBatch)) {
          merged[merged.length - 1] = part;
        }
        continue;
      }
    }
    merged.push(part);
  }
  return uniqueBy(merged, (f) => partCanonicalKey(f.partNumber));
}

/**
 * Recover a single OCR token into a canonical aviation part number when possible.
 */
export function recoverPartNumber(raw: string): string | null {
  let t = raw.toUpperCase().trim();
  t = t.replace(/\$/g, "S").replace(/\./g, "-");
  if (/^[5]A/.test(t)) t = `S${t.slice(1)}`;
  if (/^[5]L/.test(t)) t = `S${t.slice(1)}`;
  if (/^SAS\d/.test(t)) t = `SA5${t.slice(3)}`;
  // 5530851-style: 7+ digits starting with 5, often SA****** with S dropped
  if (/^5\d{6,}$/.test(t) && t.length <= 9) {
    const asSa = `SA${t.slice(1)}`;
    if (looksLikeAviationPart(asSa)) t = asSa;
    else {
      const asSl = `SL${t.slice(1)}`;
      if (looksLikeAviationPart(asSl)) t = asSl;
    }
  }
  // SLET183 / SL junk letter insertions — keep only prefix + digits (+ trailing letter code)
  if (/^SL[A-Z]{2,}\d+/.test(t)) {
    const digits = t.replace(/\D/g, "");
    if (digits.length >= 5) t = `SL${digits.slice(-5)}`;
    else return null; // wait for 5xxxxxx recovery from context
  }
  t = t.replace(/\s+(YES|NO)\b/g, "").trim();
  if (/^SASS?\d*$/i.test(t) && t.length <= 6) return null;

  t = t.replace(/\s+/g, " ").trim();
  // Normalize short modifiers: P15 → P015 when 2 digits
  t = t.replace(/\bP(\d{2})\b/g, "P0$1");
  if (!looksLikeAviationPart(t.split(/\s+/)[0] ?? t)) return null;
  return t;
}

type FoundPart = { partNumber: string; index: number; raw: string };

function findAviationParts(text: string): FoundPart[] {
  const upper = text.toUpperCase();
  const found: FoundPart[] = [];

  // Primary: SA10205-1 P020 | SL16624A M008 | SA530851 | SA2000-SC P015
  const primary =
    /\b((?:SA|SL|LW|RS|OR|BH|BRG|NUT|MS|NAS|AN|STD)[A-Z0-9]*(?:-[A-Z0-9]+)*)(?:\s+([PM]\d{2,4}|M\d{3}|P\d{2,4}|SC))?\b/gi;

  for (const match of upper.matchAll(primary)) {
    const base = match[1];
    const mod = match[2];
    const combined = mod ? `${base} ${mod}` : base;
    const recovered = recoverPartNumber(combined);
    if (!recovered) continue;
    found.push({ partNumber: recovered, index: match.index ?? 0, raw: match[0] });
  }

  // Secondary: OCR-broken tokens without spaces (avoid sucking in YES/NO)
  const broken = /\b([\$5S][AL][A-Z0-9.$]{3,16})\b/gi;
  for (const match of upper.matchAll(broken)) {
    const recovered = recoverPartNumber(match[1]);
    if (!recovered) continue;
    found.push({ partNumber: recovered, index: match.index ?? 0, raw: match[0] });
  }

  // Tertiary: 7-digit 5xxxxxx runs on packing lists → SLxxxxx (skip batch pairs + already-found cores)
  if (/BATCH\s*NUMBER|TOTAL PIECES|PMA/i.test(upper)) {
    for (const match of upper.matchAll(/\b5(\d{6})\b/g)) {
      const index = match.index ?? 0;
      const around = upper.slice(Math.max(0, index - 2), index + match[0].length + 2);
      if (/\d{6}-\d|\d-\d{6}/.test(around)) continue;
      const core = match[1].slice(-5);
      if (found.some((f) => f.partNumber.replace(/\s+/g, "").includes(core))) continue;
      // 55xxxxx is usually SA****** (Superior), not SL
      if (match[0].startsWith("55")) {
        const asSa = `SA${match[1]}`;
        found.push({ partNumber: asSa, index, raw: match[0] });
        continue;
      }
      const asSl = `SL${core}`;
      const ctx = upper.slice(Math.max(0, index - 50), index + 90);
      if (!/GASKET|GASAR|GASEER|BEARING|WASHER|GUIDE|RING|LIFTER|QUANTITY|BATCH|YES|NO/i.test(ctx)) continue;
      found.push({ partNumber: asSl, index, raw: match[0] });
    }
  }

  found.sort((a, b) => a.index - b.index || b.partNumber.length - a.partNumber.length);
  return mergeDuplicateParts(found, upper);
}

function extractBatchNear(block: string): string {
  const labeled =
    block.match(/B+atch\s*number\s*[:\s]*([0-9]{5,9})\s*[-–]?\s*([0-9]{5,9})/i) ??
    block.match(/B+atch\s*number\s*[:\s]*([0-9]{6}-[0-9]{6,9})/i);
  if (labeled) {
    if (labeled[2] && !labeled[1].includes("-")) return `${labeled[1]}-${labeled[2]}`;
    return labeled[1];
  }
  const loose = block.match(/\b(\d{6})-(\d{6,9})\b/);
  return loose ? `${loose[1]}-${loose[2]}` : "";
}

function extractQtyNear(block: string): { qty: number; unit: string } {
  const qtyLabeled = block.match(/Quantity\s*[:\s]*(\d{1,5})/i);
  if (qtyLabeled) {
    const qty = Number(qtyLabeled[1]);
    const unitMatch = block.match(/\b(\d+(?:\.\d+)?)\s*(PK-?\d*|Ea|Each|PCS?)\b/i);
    let unit = "EA";
    if (unitMatch) {
      const u = unitMatch[2].toUpperCase();
      unit = u.startsWith("PK") ? (u.match(/PK-?\d+/)?.[0].replace(/PK/i, "PK-").replace(/PK--/, "PK-") ?? "PK") : "EA";
      if (unit === "PK-") unit = "PK";
    }
    return { qty: qty > 0 && qty < 500 ? qty : 1, unit };
  }

  const ordered = block.match(/\b(\d{1,4})(?:\.00)?\s*(PK-?\d+|Ea|Each)\b/i);
  if (ordered) {
    const qty = Number(ordered[1]);
    const u = ordered[2].toUpperCase();
    return {
      qty: qty > 0 && qty < 500 ? qty : 1,
      unit: u.startsWith("PK") ? u.replace(/PK-?/, "PK-").replace(/PK--/, "PK-") : "EA",
    };
  }

  return { qty: 1, unit: "EA" };
}

function extractDescriptionNear(block: string, partNumber: string): string {
  const cleaned = block
    .replace(new RegExp(partNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ")
    .replace(/\b(?:Yes|No)\b/gi, " ")
    .replace(/Quantity\s*[:\s]*\d+/gi, " ")
    .replace(/B+atch\s*number\s*[:\s]*[0-9-]+/gi, " ")
    .replace(/\([^)]*Total pieces[^)]*\)/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:PK-?\d*|Ea|Each)\b/gi, " ")
    .replace(/\b\d+\.\d{2}\b/g, " ")
    .replace(/\b\d{6}-\d{6,9}\b/g, " ")
    .replace(/cerifad[\s\S]*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();

  const knownRe =
    /\b(GUIDE|RING SET(?: SINGLE CYLINDER)?|BODY HYD LIFTER|GASKET|BEARING CONNECTING ROD|BEARING CRANKSHAFT|THRUST WASHER|BEARING|WASHER|LIFTER)\b/gi;
  const knownHits = [...cleaned.matchAll(knownRe)].map((m) => m[1]);
  // Prefer the last hit — closest to the item token when looking backwards
  const known = knownHits.length ? knownHits[knownHits.length - 1] : "";

  if (known) return known.replace(/\s+/g, " ").trim().slice(0, 80);

  const words = cleaned
    .split(" ")
    .filter((w) => w.length > 2 && !/^\d+$/.test(w) && !PART_DENYLIST.has(w.toUpperCase()))
    .slice(0, 5)
    .join(" ");
  return words.slice(0, 80) || `Part ${partNumber}`;
}

function refinePartFromBlock(partNumber: string, block: string): string {
  let pn = partNumber.replace(/\s+(YES|NO)\b/gi, "").trim();
  pn = pn.replace(/\b20(\d{2})\b/g, "P$1");
  pn = pn.replace(/\bMOS\b/gi, "M008").replace(/\bMOOS\b/gi, "M005");

  if (/^SL/i.test(pn)) {
    const seven = block.match(/\b5(\d{6})\b/);
    if (seven) {
      const candidate = `SL${seven[1].slice(-5)}`;
      if (/[A-Z]{2,}/.test(pn.slice(2)) || pn.replace(/\s.*/, "").length < 8) {
        pn = candidate;
      }
    }
  }

  // Keep letter suffix on bearings: SL16624A
  const letterSuffix = block.slice(0, 70).match(/\bSL\d{5}([A-Z])\b/i);
  if (letterSuffix && /^SL\d{5}$/i.test(pn)) {
    pn = `${pn}${letterSuffix[1].toUpperCase()}`;
  }

  if (!/\s[PM]\d{2,4}$/i.test(pn)) {
    const mod = block.slice(0, 80).match(/\b([PM]\d{3,4}|M008|M005)\b/i);
    if (mod && !pn.toUpperCase().includes(mod[1].toUpperCase())) {
      pn = `${pn} ${mod[1].toUpperCase().replace(/^MOS$/i, "M008")}`;
    }
  }
  return pn.replace(/\s+/g, " ").trim();
}

/**
 * Superior / Adams style packing list: one item number row + Quantity/Batch under it.
 */
export function parsePackingListLines(text: string): OcrExtractedLine[] {
  const parts = findAviationParts(text);
  if (!parts.length) return [];

  const lines: OcrExtractedLine[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const end = i + 1 < parts.length ? parts[i + 1].index : Math.min(text.length, part.index + 420);
    // Batch/qty only forward from the item token — avoids stealing previous row's batch
    const forward = text.slice(part.index, end);
    const batchAt = forward.search(/B+atch\s*number/i);
    const descForwardEnd = batchAt >= 0 ? Math.min(forward.length, batchAt + 40) : Math.min(forward.length, 160);
    const afterForDesc = forward.slice(0, descForwardEnd);
    const beforeForDesc = text.slice(Math.max(0, part.index - 120), part.index);
    const partNumber = refinePartFromBlock(part.partNumber, forward);
    const batchNumber = extractBatchNear(forward);
    const { qty, unit } = extractQtyNear(forward);
    const afterDesc = extractDescriptionNear(afterForDesc, partNumber);
    const beforeDesc = extractDescriptionNear(beforeForDesc, partNumber);
    let description = afterDesc;
    const afterJunk =
      /^Part /i.test(afterDesc) ||
      /pieces/i.test(afterDesc) ||
      /^\(/i.test(afterDesc) ||
      /^\{/i.test(afterDesc) ||
      afterDesc.length < 4;
    if (afterJunk && !/^Part /i.test(beforeDesc) && beforeDesc.length > 3) {
      description = beforeDesc;
    } else if (/^GASKET$/i.test(afterDesc) && /BODY HYD|RING SET|GUIDE|BEARING|THRUST|LIFTER/i.test(beforeDesc)) {
      description = beforeDesc;
    }
    if (/^\{?\d|SAS\d|cerifad|pieces\)/i.test(description) || /pieces/i.test(description)) {
      description = !/^Part /i.test(beforeDesc) && beforeDesc.length > 3 ? beforeDesc : `Part ${partNumber}`;
    }

    const packingDoc = /Batch\s*number|Total pieces|PMA/i.test(text);
    if (packingDoc && !batchNumber && !/GUIDE|RING|GASKET|BEARING|WASHER|LIFTER|HYD/i.test(description)) {
      continue;
    }

    lines.push({
      partNumber,
      description,
      quantity: qty,
      unit: unit === "PK-" ? "PK" : unit,
      batchNumber,
      serialNumbers: "",
      expiryDate: "",
      condition: "NEW",
      origin: /\bUS\b/i.test(forward) ? "US" : "",
      weightKg: null,
      confidence: batchNumber ? 0.86 : 0.7,
    });
  }

  // Collapse OCR twin reads of one bearing row (SL16624 + SL61662A)
  const out: OcrExtractedLine[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const cur = lines[i];
    const next = lines[i + 1];
    if (
      next &&
      cur.partNumber.startsWith("SL") &&
      next.partNumber.startsWith("SL") &&
      !cur.batchNumber &&
      next.batchNumber &&
      /BEARING CONNECTING/i.test(cur.description) &&
      /BEARING/i.test(next.description)
    ) {
      out.push({
        ...next,
        partNumber: cur.partNumber.length >= 10 ? cur.partNumber : next.partNumber,
        description: /CONNECTING/i.test(cur.description) ? cur.description : next.description,
        quantity: next.quantity || cur.quantity,
        batchNumber: next.batchNumber,
      });
      i += 1;
      continue;
    }
    out.push(cur);
  }

  return uniqueBy(out, (l) => digitsCore(l.partNumber) || partCanonicalKey(l.partNumber));
}

function detectSupplier(upper: string): string {
  // Manufacturer on CoC / packing list wins over Sold-to customer
  if (upper.includes("SUPERIOR AIR PARTS") || upper.includes("SUPERIOR AR PARTS") || upper.includes("SUPERIOR AIR")) {
    return "Superior Air Parts";
  }
  if (upper.includes("SATAIR")) return "Satair UK";
  if (upper.includes("AVIALL")) return "Aviall Services";
  if (upper.includes("LYCOMING")) return "Lycoming Engines";
  if (upper.includes("CONTINENTAL")) return "Continental Aerospace";
  if (upper.includes("AIRPART") || upper.includes("AIR PART")) return "Airpart";
  if (upper.includes("ADAMS AVIATION")) return "Adams Aviation";
  return "";
}

function sanitizeCertificate(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/conformance|certificate|superior|federal|aviation/i.test(v)) return "";
  if (v.length < 5) return "";
  return v;
}

function sanitizeInvoiceRef(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (v.length < 3) return "";
  if (/^(ld|of|no|inv)$/i.test(v)) return "";
  if (/conformance|certificate/i.test(v)) return "";
  return v;
}

/** Parse OCR / pasted invoice text into GRN header + line suggestions */
export function parseInvoiceText(rawText: string): OcrExtractResult {
  const text = normalizeOcrText(rawText);
  const warnings: string[] = [];
  const upper = text.toUpperCase();

  const supplierName = detectSupplier(upper);
  const salesOrder = text.match(ORDER_PATTERN)?.[1] ?? "";
  const certificateNumber = sanitizeCertificate(
    text.match(CERT_PATTERN)?.[1] ??
      text.match(/\b(?:Cert(?:ificate)?(?:\s*Ref(?:erence)?)?|ST)[:\s#-]*([A-Z0-9-]{5,})\b/i)?.[1] ??
      "",
  );
  const customerOrder = text.match(CUST_ORDER_PATTERN)?.[1] ?? "";
  const date = text.match(DATE_PATTERN)?.[1] ?? "";
  const docRef = text.match(DOC_REF_PATTERN)?.[1] ?? "";
  const invoiceMatch = sanitizeInvoiceRef(text.match(/\b(?:Invoice|INV)[:\s#-]*([A-Z0-9-]{3,})/i)?.[1] ?? "");
  const invoiceReference = sanitizeInvoiceRef(invoiceMatch || docRef || salesOrder || "");
  const grDigits = text.match(GRN_PATTERN)?.[1];
  const grNumber = grDigits ? `GR${grDigits}` : undefined;

  const serialBlock = text.match(SERIAL_PATTERN)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const condition = normalizeCondition(text);
  const origin = /\bUS\b/.test(upper) ? "US" : /\bUK\b/.test(upper) ? "UK" : "";
  const weightMatch = text.match(WEIGHT_PATTERN);
  const weightKg = weightMatch ? Number(weightMatch[1]) : null;

  // Prefer structured packing-list extraction (Superior / Adams style)
  let lines = parsePackingListLines(text);

  if (!lines.length) {
    warnings.push("No part numbers detected. Check image clarity or enter lines manually.");
  } else if (lines.some((l) => !l.batchNumber) && /Batch\s*number/i.test(text)) {
    warnings.push("Some batch numbers were unclear — check amber fields before creating GRNs.");
  }

  // Attach serial only for single-line serialised docs
  if (lines.length === 1 && serialBlock) {
    lines = [
      {
        ...lines[0],
        serialNumbers: serialBlock,
        quantity: 1,
      },
    ];
  }

  // Shared origin/weight/condition
  lines = lines.map((line, index) => ({
    ...line,
    condition: line.condition || condition,
    origin: line.origin || origin,
    weightKg: index === 0 ? weightKg : line.weightKg,
  }));

  if (!supplierName) warnings.push("Supplier not detected — fill manually.");
  if (!invoiceReference && !certificateNumber) {
    warnings.push("Invoice / document reference not found — fill manually if needed.");
  }

  return {
    supplierName,
    salesOrder,
    certificateNumber,
    customerOrder,
    invoiceReference,
    date,
    grNumber,
    rawText: text,
    lines,
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
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    // Dense packing-list tables read better as a uniform block of text
    await worker.setParameters({
      // Dense packing-list tables read better as a uniform block of text
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
    });
    const {
      data: { text },
    } = await worker.recognize(file);
    const parsed = parseInvoiceText(text || "");
    parsed.engine = "tesseract";
    if (!text.trim()) {
      parsed.warnings.unshift("OCR returned empty text. Try a clearer photo or PDF page.");
    } else {
      parsed.warnings.unshift(
        "Read on-device (Tesseract). For UK production accuracy, configure Azure Document Intelligence.",
      );
      if (parsed.lines.length > 1) {
        parsed.warnings.unshift(
          `${parsed.lines.length} product lines detected — each will get its own GRN after review.`,
        );
      }
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
