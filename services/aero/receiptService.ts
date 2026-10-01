import { createId, nowIso } from "@/lib/utils";
import type { AeroReceiptLine, InventoryStockRow, PartCondition, ReceiptLineStatus } from "@/types/aeroswift";
import { deriveLineStatus, lineInBoxQty } from "@/types/aeroswift";
import { getDb } from "@/db/aero-db";

export interface ReceiptLineInput {
  grNumber?: string;
  jobId: string | null;
  partNumber: string;
  alternativePartNumber?: string;
  description: string;
  quantity: number;
  unit: string;
  batchNumber: string;
  serialNumbers: string;
  expiryDate: string;
  condition: PartCondition;
  origin: string;
  weightKg: number | null;
  costPerUnit?: number | null;
  supplierName: string;
  salesOrder: string;
  certificateNumber: string;
  certificateOnFile?: boolean;
  customerOrder: string;
  invoiceReference: string;
  boxId: string | null;
  notes: string;
  sourceDocumentName?: string;
  ocrConfidence?: number | null;
}

export interface ReceiptLineEditValues {
  partNumber: string;
  alternativePartNumber: string;
  description: string;
  batchNumber: string;
  grNumber: string;
  supplierName: string;
  invoiceReference: string;
  costPerUnit: number | null;
  certificateNumber: string;
  certificateOnFile: boolean;
  quantity: number;
  usedQuantity: number;
  outQuantity: number;
  assignedTo: string;
  boxId: string | null;
  notes: string;
}

function normalizeQuantities(quantity: number, usedQuantity: number, outQuantity: number) {
  const total = Math.max(0, Math.floor(quantity));
  let used = Math.max(0, Math.floor(usedQuantity));
  let out = Math.max(0, Math.floor(outQuantity));
  if (used > total) used = total;
  if (used + out > total) out = Math.max(0, total - used);
  return { quantity: total, usedQuantity: used, outQuantity: out };
}

export const receiptService = {
  async list() {
    return getDb().receiptLines.orderBy("grNumber").reverse().toArray();
  },

  async listForJob(jobId: string) {
    return getDb().receiptLines.where("jobId").equals(jobId).sortBy("createdAt");
  },

  async get(id: string) {
    return getDb().receiptLines.get(id);
  },

  async listInBoxes() {
    return (await this.list()).filter((row) => lineInBoxQty(row) > 0);
  },

  async listOut() {
    return (await this.list()).filter((row) => row.outQuantity > 0);
  },

  async counts() {
    const lines = await this.list();
    return {
      inBoxes: lines.reduce((sum, l) => sum + lineInBoxQty(l), 0),
      outWithSomeone: lines.reduce((sum, l) => sum + l.outQuantity, 0),
      lineCountInBoxes: lines.filter((l) => lineInBoxQty(l) > 0).length,
      lineCountOut: lines.filter((l) => l.outQuantity > 0).length,
      totalLines: lines.length,
    };
  },

  async nextGrNumber() {
    const settings = await getDb().settings.get("app");
    const next = settings?.nextGrSequence ?? 1;
    return String(next);
  },

  async allocateGrNumbers(count: number) {
    const db = getDb();
    const settings = await db.settings.get("app");
    if (!settings) throw new Error("Settings missing");
    const start = settings.nextGrSequence;
    const numbers = Array.from({ length: count }, (_, i) => String(start + i));
    await db.settings.put({
      ...settings,
      nextGrSequence: start + count,
      updatedAt: nowIso(),
    });
    return numbers;
  },

  async createMany(inputs: ReceiptLineInput[]) {
    if (!inputs.length) throw new Error("Add at least one part line");
    const grNumbers = await this.allocateGrNumbers(inputs.length);
    const timestamp = nowIso();
    const [boxes, jobs] = await Promise.all([getDb().boxes.toArray(), getDb().jobs.toArray()]);
    const boxMap = new Map(boxes.map((b) => [b.id, b.area ? `${b.area} — ${b.name}` : b.name]));
    const jobMap = new Map(jobs.map((j) => [j.id, j.jobNumber]));

    const rows: AeroReceiptLine[] = inputs.map((input, index) => {
      const qty = Math.max(1, Math.floor(input.quantity));
      const row: AeroReceiptLine = {
        id: createId(),
        grNumber: input.grNumber?.trim() || grNumbers[index],
        jobId: input.jobId,
        partNumber: input.partNumber.trim().toUpperCase(),
        alternativePartNumber: (input.alternativePartNumber ?? "").trim().toUpperCase(),
        description: input.description.trim(),
        quantity: qty,
        usedQuantity: 0,
        outQuantity: 0,
        unit: input.unit.trim() || "EA",
        batchNumber: input.batchNumber.trim(),
        serialNumbers: input.serialNumbers.trim(),
        expiryDate: input.expiryDate.trim(),
        condition: input.condition,
        origin: input.origin.trim().toUpperCase(),
        weightKg: input.weightKg,
        costPerUnit: input.costPerUnit ?? null,
        supplierName: input.supplierName.trim(),
        salesOrder: input.salesOrder.trim(),
        certificateNumber: input.certificateNumber.trim(),
        certificateOnFile: Boolean(input.certificateOnFile ?? Boolean(input.certificateNumber.trim())),
        customerOrder: input.customerOrder.trim(),
        invoiceReference: input.invoiceReference.trim(),
        boxId: input.boxId,
        status: "in_box",
        assignedTo: "",
        checked: true,
        notes: input.notes,
        sourceDocumentName: input.sourceDocumentName ?? "",
        ocrConfidence: input.ocrConfidence ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      row.status = deriveLineStatus(row);
      return row;
    });

    const history: Array<{
      id: string;
      at: string;
      what: "added" | "moved_to_inventory";
      lineId: string;
      partNumber: string;
      quantity: number;
      jobId: string | null;
      jobNumber: string | null;
      note: string;
    }> = [];

    for (const row of rows) {
      const jobNumber = row.jobId ? jobMap.get(row.jobId) ?? null : null;
      history.push({
        id: createId(),
        at: timestamp,
        what: "added",
        lineId: row.id,
        partNumber: row.partNumber,
        quantity: row.quantity,
        jobId: row.jobId,
        jobNumber,
        note: `GR${row.grNumber.replace(/^GR/i, "")} booked in`,
      });
      if (row.boxId) {
        history.push({
          id: createId(),
          at: timestamp,
          what: "moved_to_inventory",
          lineId: row.id,
          partNumber: row.partNumber,
          quantity: row.quantity,
          jobId: row.jobId,
          jobNumber,
          note: boxMap.get(row.boxId) ?? "Boxed",
        });
      }
    }

    await getDb().transaction("rw", [getDb().receiptLines, getDb().historyEvents], async () => {
      await getDb().receiptLines.bulkAdd(rows);
      if (history.length) await getDb().historyEvents.bulkAdd(history);
    });
    return rows;
  },

  async update(id: string, values: ReceiptLineEditValues) {
    const row = await this.get(id);
    if (!row) throw new Error("Line not found");
    const qty = normalizeQuantities(values.quantity, values.usedQuantity, values.outQuantity);
    if (qty.outQuantity > 0 && !values.assignedTo.trim()) {
      throw new Error("Enter who has the part out");
    }
    const next: AeroReceiptLine = {
      ...row,
      partNumber: values.partNumber.trim().toUpperCase(),
      alternativePartNumber: values.alternativePartNumber.trim().toUpperCase(),
      description: values.description.trim(),
      batchNumber: values.batchNumber.trim(),
      grNumber: values.grNumber.trim().replace(/^GR/i, "") || row.grNumber,
      supplierName: values.supplierName.trim(),
      invoiceReference: values.invoiceReference.trim(),
      costPerUnit: values.costPerUnit,
      certificateNumber: values.certificateNumber.trim(),
      certificateOnFile: values.certificateOnFile,
      ...qty,
      assignedTo: qty.outQuantity > 0 ? values.assignedTo.trim() : "",
      boxId: values.boxId,
      notes: values.notes,
      status: deriveLineStatus(qty),
      updatedAt: nowIso(),
    };
    await getDb().receiptLines.put(next);
    return next;
  },

  /** Consume qty from box first, then from out-with-someone, onto the job (used). */
  async useOnJob(id: string, qty: number, note: string, targetJobId?: string | null) {
    const row = await this.get(id);
    if (!row) throw new Error("Line not found");
    const amount = Math.floor(qty);
    if (amount < 1) throw new Error("Quantity must be at least 1");
    const available = lineInBoxQty(row) + row.outQuantity;
    if (amount > available) throw new Error(`Only ${available} available to use`);

    let remaining = amount;
    let out = row.outQuantity;
    const takeBox = Math.min(remaining, lineInBoxQty(row));
    remaining -= takeBox;
    const takeOut = Math.min(remaining, out);
    out -= takeOut;

    const qtyNorm = normalizeQuantities(row.quantity, row.usedQuantity + amount, out);
    const next: AeroReceiptLine = {
      ...row,
      ...qtyNorm,
      jobId: targetJobId ?? row.jobId,
      assignedTo: qtyNorm.outQuantity > 0 ? row.assignedTo : "",
      notes: note.trim() ? `${row.notes ? `${row.notes}\n` : ""}${note.trim()}`.trim() : row.notes,
      status: deriveLineStatus(qtyNorm),
      updatedAt: nowIso(),
    };
    await getDb().receiptLines.put(next);
    return next;
  },

  async issueToPerson(id: string, person: string, qty?: number) {
    const row = await this.get(id);
    if (!row) throw new Error("Line not found");
    if (!person.trim()) throw new Error("Enter who has the part");
    const inBox = lineInBoxQty(row);
    const amount = qty == null ? inBox : Math.floor(qty);
    if (amount < 1) throw new Error("Nothing left in the box to issue");
    if (amount > inBox) throw new Error(`Only ${inBox} in the box`);
    const qtyNorm = normalizeQuantities(row.quantity, row.usedQuantity, row.outQuantity + amount);
    const next: AeroReceiptLine = {
      ...row,
      ...qtyNorm,
      assignedTo: person.trim(),
      status: deriveLineStatus(qtyNorm),
      updatedAt: nowIso(),
    };
    await getDb().receiptLines.put(next);
    return next;
  },

  async returnToBox(id: string, boxId: string | null) {
    const row = await this.get(id);
    if (!row) throw new Error("Line not found");
    const qtyNorm = normalizeQuantities(row.quantity, row.usedQuantity, 0);
    const next: AeroReceiptLine = {
      ...row,
      ...qtyNorm,
      assignedTo: "",
      boxId: boxId ?? row.boxId,
      status: deriveLineStatus(qtyNorm),
      updatedAt: nowIso(),
    };
    await getDb().receiptLines.put(next);
    return next;
  },

  async markUsedOnJob(id: string) {
    const row = await this.get(id);
    if (!row) throw new Error("Line not found");
    const available = lineInBoxQty(row) + row.outQuantity;
    if (available < 1) throw new Error("Nothing left to use");
    return this.useOnJob(id, available, "");
  },

  async delete(id: string) {
    const row = await this.get(id);
    if (!row) throw new Error("Line not found");
    await getDb().receiptLines.delete(id);
  },

  async changeBox(id: string, boxId: string | null) {
    const row = await this.get(id);
    if (!row) throw new Error("Line not found");
    const next = { ...row, boxId, updatedAt: nowIso() };
    await getDb().receiptLines.put(next);
    return next;
  },

  async inventoryRows(): Promise<InventoryStockRow[]> {
    const [lines, boxes, jobs] = await Promise.all([
      this.list(),
      getDb().boxes.toArray(),
      getDb().jobs.toArray(),
    ]);
    const boxMap = new Map(boxes.map((b) => [b.id, b.area ? `${b.area} — ${b.name}` : b.name]));
    const jobMap = new Map(jobs.map((j) => [j.id, j.jobNumber]));
    const rows: InventoryStockRow[] = [];

    for (const line of lines) {
      const inBox = lineInBoxQty(line);
      if (inBox > 0) {
        rows.push({
          partNumber: line.partNumber,
          description: line.description,
          quantity: inBox,
          boxName: line.boxId ? boxMap.get(line.boxId) ?? "—" : "Unassigned",
          grNumbers: [line.grNumber],
          status: "in_box",
          assignedTo: "",
          jobNumber: line.jobId ? jobMap.get(line.jobId) ?? null : null,
        });
      }
      if (line.outQuantity > 0) {
        rows.push({
          partNumber: line.partNumber,
          description: line.description,
          quantity: line.outQuantity,
          boxName: line.boxId ? boxMap.get(line.boxId) ?? "—" : "—",
          grNumbers: [line.grNumber],
          status: "out_with_someone",
          assignedTo: line.assignedTo,
          jobNumber: line.jobId ? jobMap.get(line.jobId) ?? null : null,
        });
      }
    }
    return rows.sort((a, b) => a.partNumber.localeCompare(b.partNumber));
  },

  async search(query: string) {
    const needle = query.trim().toLowerCase();
    if (!needle) return [] as AeroReceiptLine[];
    const lines = await this.list();
    return lines.filter((line) =>
      [
        line.grNumber,
        line.partNumber,
        line.alternativePartNumber,
        line.description,
        line.batchNumber,
        line.serialNumbers,
        line.supplierName,
        line.salesOrder,
        line.certificateNumber,
        line.assignedTo,
        line.invoiceReference,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  },
};
