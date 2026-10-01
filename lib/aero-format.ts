import type { AeroReceiptLine } from "@/types/aeroswift";

export function unitHint(unit: string) {
  const u = (unit || "EA").toLowerCase();
  if (u === "metres" || u === "meters" || u === "m") return "metres";
  if (u === "grams" || u === "g" || u === "gram") return "grams";
  if (u === "set" || u === "sets") return "set";
  if (u === "ea" || u === "each") return "each";
  return u || "each";
}

export function formatQtyWithUnit(qty: number, unit: string) {
  const u = (unit || "EA").toLowerCase();
  if (u === "metres" || u === "meters" || u === "m") return `${qty} metres`;
  if (u === "grams" || u === "g" || u === "gram") return `${qty} grams`;
  if (u === "set" || u === "sets") return `${qty} set`;
  return String(qty);
}

export function formatSerialOrBatch(line: Pick<AeroReceiptLine, "serialNumbers" | "batchNumber">) {
  const serial = line.serialNumbers?.trim();
  if (serial) {
    const cleaned = serial.replace(/^SN[\s-]*/i, "");
    return `SN ${cleaned}`;
  }
  const batch = line.batchNumber?.trim();
  if (batch) return `Batch ${batch.replace(/^Batch\s+/i, "")}`;
  return "—";
}
