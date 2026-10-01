export type JobStatus = "open" | "in_progress" | "completed";

export type ReceiptLineStatus = "in_box" | "out_with_someone" | "used_on_job";

export type PartCondition = "NEW" | "Overhauled" | "Repaired" | "Used" | "Unknown";

export interface AeroUser {
  id: string;
  email: string;
  name: string;
  password: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AeroJob {
  id: string;
  jobNumber: string;
  title: string;
  engineType: string;
  engineSerial: string;
  customer: string;
  registration: string;
  status: JobStatus;
  notes: string;
  /** Planned / expected part quantity for progress “13 of 30” */
  expectedParts: number;
  startDate: string | null;
  completionDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AeroBox {
  id: string;
  name: string;
  code: string;
  /** e.g. Area A */
  area: string;
  description: string;
  active: boolean;
  createdAt: string;
}

export interface AeroReceiptLine {
  id: string;
  /** Per-line GR number — company process (e.g. 1075) */
  grNumber: string;
  jobId: string | null;
  partNumber: string;
  alternativePartNumber: string;
  description: string;
  /** Total quantity on the GR line */
  quantity: number;
  /** Qty already fitted / consumed */
  usedQuantity: number;
  /** Qty currently out with a person */
  outQuantity: number;
  unit: string;
  batchNumber: string;
  serialNumbers: string;
  expiryDate: string;
  condition: PartCondition;
  origin: string;
  weightKg: number | null;
  costPerUnit: number | null;
  supplierName: string;
  salesOrder: string;
  certificateNumber: string;
  certificateOnFile: boolean;
  customerOrder: string;
  invoiceReference: string;
  boxId: string | null;
  /** Derived primary status for filters */
  status: ReceiptLineStatus;
  assignedTo: string;
  checked: boolean;
  notes: string;
  sourceDocumentName: string;
  ocrConfidence: number | null;
  createdAt: string;
  updatedAt: string;
}

export type HistoryWhat = "added" | "used" | "issued" | "moved_to_inventory";

export interface AeroHistoryEvent {
  id: string;
  at: string;
  what: HistoryWhat;
  lineId: string;
  partNumber: string;
  quantity: number;
  jobId: string | null;
  jobNumber: string | null;
  note: string;
}

export interface AeroSettings {
  id: string;
  companyName: string;
  nextGrSequence: number;
  updatedAt: string;
}

export interface OcrExtractedLine {
  partNumber: string;
  description: string;
  quantity: number;
  unit: string;
  batchNumber: string;
  serialNumbers: string;
  expiryDate: string;
  condition: PartCondition;
  origin: string;
  weightKg: number | null;
  confidence: number;
}

export interface OcrExtractResult {
  supplierName: string;
  salesOrder: string;
  certificateNumber: string;
  customerOrder: string;
  invoiceReference: string;
  date: string;
  /** Suggested GRN if found on the document (e.g. GR1087) */
  grNumber?: string;
  rawText: string;
  lines: OcrExtractedLine[];
  warnings: string[];
  /** Which engine produced this result */
  engine?: "azure" | "tesseract" | "paste" | "pdf-text";
}

export interface InventoryStockRow {
  partNumber: string;
  description: string;
  quantity: number;
  boxName: string;
  grNumbers: string[];
  status: ReceiptLineStatus;
  assignedTo: string;
  jobNumber: string | null;
}

/** Helpers for split quantities on a receipt line */
export function lineInBoxQty(line: Pick<AeroReceiptLine, "quantity" | "usedQuantity" | "outQuantity">) {
  return Math.max(0, line.quantity - line.usedQuantity - line.outQuantity);
}

export function lineLeftQty(line: Pick<AeroReceiptLine, "quantity" | "usedQuantity">) {
  return Math.max(0, line.quantity - line.usedQuantity);
}

export function deriveLineStatus(line: Pick<AeroReceiptLine, "quantity" | "usedQuantity" | "outQuantity">): ReceiptLineStatus {
  const inBox = lineInBoxQty(line);
  if (line.quantity > 0 && line.usedQuantity >= line.quantity) return "used_on_job";
  if (inBox <= 0 && line.outQuantity > 0) return "out_with_someone";
  if (inBox > 0) return "in_box";
  if (line.outQuantity > 0) return "out_with_someone";
  return "used_on_job";
}
