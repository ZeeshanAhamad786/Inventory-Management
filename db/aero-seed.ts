import { createId, nowIso } from "@/lib/utils";
import type { AeroBox, AeroHistoryEvent, AeroJob, AeroReceiptLine, AeroSettings, AeroUser } from "@/types/aeroswift";
import { deriveLineStatus } from "@/types/aeroswift";
import { getDb } from "./aero-db";

const DEMO = {
  email: "admin@demo.local",
  password: "admin123",
};

export async function seedIfEmpty() {
  const db = getDb();
  const existing = await db.settings.get("app");
  if (existing) return false;
  await seedDatabase();
  return true;
}

export async function seedDatabase() {
  const db = getDb();
  const createdAt = nowIso();

  const user: AeroUser = {
    id: "user-admin",
    email: DEMO.email,
    name: "Stores Admin",
    password: DEMO.password,
    active: true,
    createdAt,
    updatedAt: createdAt,
  };

  const settings: AeroSettings = {
    id: "app",
    companyName: "Aeroswift Parts Control",
    nextGrSequence: 1100,
    updatedAt: createdAt,
  };

  const boxes: AeroBox[] = [
    { id: "box-a", name: "Box A", code: "A-A", area: "Area A", description: "Bearings", active: true, createdAt },
    { id: "box-c", name: "Box C", code: "A-C", area: "Area A", description: "Fasteners & seals", active: true, createdAt },
    { id: "box-rack2", name: "Rack 2", code: "B-R2", area: "Area B", description: "Wire & cable", active: true, createdAt },
    { id: "box-shelf1", name: "Shelf 1", code: "MS-1", area: "Main store", description: "Hardware", active: true, createdAt },
    { id: "box-2", name: "Box 2", code: "ASH2", area: "Area B", description: "Washers", active: true, createdAt },
  ];

  const jobs: AeroJob[] = [
    {
      id: "job-128",
      jobNumber: "WP-128",
      title: "Engine overhaul",
      engineType: "CFM56-7B26",
      engineSerial: "894412",
      customer: "Skyline Charter",
      registration: "G-TKLA",
      status: "in_progress",
      notes: "Major overhaul in bay 2",
      expectedParts: 30,
      startDate: "2026-08-24T10:00:00.000Z",
      completionDate: null,
      createdAt: "2026-08-24T10:00:00.000Z",
      updatedAt: "2026-09-20T10:00:00.000Z",
    },
    {
      id: "job-131",
      jobNumber: "WP-131",
      title: "HP module strip",
      engineType: "CF34-8E5",
      engineSerial: "193007",
      customer: "Northgate Regional",
      registration: "G-NRGB",
      status: "in_progress",
      notes: "",
      expectedParts: 1,
      startDate: "2026-09-02T10:00:00.000Z",
      completionDate: null,
      createdAt: "2026-09-02T10:00:00.000Z",
      updatedAt: "2026-09-19T10:00:00.000Z",
    },
    {
      id: "job-126",
      jobNumber: "WP-126",
      title: "Borescope repair",
      engineType: "PW127M",
      engineSerial: "CE0771",
      customer: "Tern Air",
      registration: "G-TRNA",
      status: "open",
      notes: "",
      expectedParts: 2,
      startDate: "2026-08-11T10:00:00.000Z",
      completionDate: null,
      createdAt: "2026-08-11T10:00:00.000Z",
      updatedAt: "2026-09-18T10:00:00.000Z",
    },
    {
      id: "job-119",
      jobNumber: "WP-119",
      title: "Engine build",
      engineType: "CFM56-5B4",
      engineSerial: "779118",
      customer: "Skyline Charter",
      registration: "G-SKYC",
      status: "completed",
      notes: "Closed and signed off",
      expectedParts: 400,
      startDate: "2026-06-30T10:00:00.000Z",
      completionDate: "2026-08-12T10:00:00.000Z",
      createdAt: "2026-06-30T10:00:00.000Z",
      updatedAt: "2026-08-12T10:00:00.000Z",
    },
  ];

  const line = (
    partial: Partial<AeroReceiptLine> &
      Pick<
        AeroReceiptLine,
        | "grNumber"
        | "jobId"
        | "partNumber"
        | "description"
        | "quantity"
        | "unit"
        | "batchNumber"
        | "serialNumbers"
        | "expiryDate"
        | "condition"
        | "origin"
        | "weightKg"
        | "supplierName"
        | "salesOrder"
        | "certificateNumber"
        | "customerOrder"
        | "invoiceReference"
        | "boxId"
        | "assignedTo"
        | "notes"
      >,
  ): AeroReceiptLine => {
    const usedQuantity = partial.usedQuantity ?? 0;
    const outQuantity = partial.outQuantity ?? 0;
    const row: AeroReceiptLine = {
      id: partial.id ?? createId(),
      grNumber: partial.grNumber,
      jobId: partial.jobId,
      partNumber: partial.partNumber,
      alternativePartNumber: partial.alternativePartNumber ?? "",
      description: partial.description,
      quantity: partial.quantity,
      usedQuantity,
      outQuantity,
      unit: partial.unit,
      batchNumber: partial.batchNumber,
      serialNumbers: partial.serialNumbers,
      expiryDate: partial.expiryDate,
      condition: partial.condition,
      origin: partial.origin,
      weightKg: partial.weightKg,
      costPerUnit: partial.costPerUnit ?? null,
      supplierName: partial.supplierName,
      salesOrder: partial.salesOrder,
      certificateNumber: partial.certificateNumber,
      certificateOnFile: partial.certificateOnFile ?? Boolean(partial.certificateNumber),
      customerOrder: partial.customerOrder,
      invoiceReference: partial.invoiceReference,
      boxId: partial.boxId,
      status: "in_box",
      assignedTo: partial.assignedTo,
      checked: true,
      notes: partial.notes,
      sourceDocumentName: "",
      ocrConfidence: null,
      createdAt: partial.createdAt ?? createdAt,
      updatedAt: partial.updatedAt ?? createdAt,
    };
    row.status = deriveLineStatus(row);
    return row;
  };

  // WP-128: 30 added, 13 used, 17 still held — matches detail screenshot
  const receiptLines: AeroReceiptLine[] = [
    line({
      id: "line-rs204",
      grNumber: "1075",
      jobId: "job-128",
      partNumber: "RS-204",
      alternativePartNumber: "RS-204A",
      description: "Rubber seal, LP compressor case",
      quantity: 5,
      usedQuantity: 3,
      outQuantity: 0,
      unit: "EA",
      batchNumber: "B-4471",
      serialNumbers: "",
      expiryDate: "",
      condition: "NEW",
      origin: "US",
      weightKg: 0.12,
      costPerUnit: 14.2,
      supplierName: "Aviall Services",
      salesOrder: "S909125",
      certificateNumber: "AV-88210",
      certificateOnFile: true,
      customerOrder: "ahmed",
      invoiceReference: "INV-33418",
      boxId: "box-c",
      assignedTo: "",
      notes: "Fitted to LP case split line",
      createdAt: "2026-08-26T10:00:00.000Z",
      updatedAt: "2026-09-10T10:00:00.000Z",
    }),
    line({
      id: "line-bh310",
      grNumber: "1076",
      jobId: "job-128",
      partNumber: "BH-310",
      alternativePartNumber: "",
      description: "Bush, fan case mount",
      quantity: 4,
      usedQuantity: 4,
      outQuantity: 0,
      unit: "EA",
      batchNumber: "B-4472",
      serialNumbers: "",
      expiryDate: "",
      condition: "NEW",
      origin: "US",
      weightKg: 0.4,
      costPerUnit: 31.5,
      supplierName: "Aviall Services",
      salesOrder: "S909125",
      certificateNumber: "AV-88211",
      certificateOnFile: true,
      customerOrder: "ahmed",
      invoiceReference: "INV-33418",
      boxId: "box-c",
      assignedTo: "",
      notes: "All four fitted, none left",
      createdAt: "2026-08-26T09:20:00.000Z",
      updatedAt: "2026-09-02T11:05:00.000Z",
    }),
    line({
      id: "line-brg7712",
      grNumber: "1079",
      jobId: "job-128",
      partNumber: "BRG-7712",
      alternativePartNumber: "",
      description: "No.3 bearing assembly",
      quantity: 1,
      usedQuantity: 0,
      outQuantity: 0,
      unit: "EA",
      batchNumber: "B-7712",
      serialNumbers: "44-9928",
      expiryDate: "",
      condition: "NEW",
      origin: "US",
      weightKg: 2.1,
      costPerUnit: 640,
      supplierName: "Aviall Services",
      salesOrder: "S909300",
      certificateNumber: "AV-90012",
      certificateOnFile: true,
      customerOrder: "ahmed",
      invoiceReference: "INV-33501",
      boxId: "box-a",
      assignedTo: "",
      notes: "",
      createdAt: "2026-09-14T10:00:00.000Z",
      updatedAt: "2026-09-14T10:00:00.000Z",
    }),
    line({
      id: "line-sl103",
      grNumber: "1078",
      jobId: "job-128",
      partNumber: "SL10302-A21P",
      alternativePartNumber: "",
      description: "O-ring pack, HP spool",
      quantity: 20,
      usedQuantity: 6,
      outQuantity: 0,
      unit: "EA",
      batchNumber: "C407522",
      serialNumbers: "",
      expiryDate: "",
      condition: "NEW",
      origin: "US",
      weightKg: 0.8,
      costPerUnit: 22.5,
      supplierName: "Adams Aviation",
      salesOrder: "S909201",
      certificateNumber: "0007306001",
      certificateOnFile: true,
      customerOrder: "ahmed",
      invoiceReference: "INV-33421",
      boxId: "box-2",
      assignedTo: "",
      notes: "",
      createdAt: "2026-09-15T10:00:00.000Z",
      updatedAt: "2026-09-15T10:00:00.000Z",
    }),
    line({
      id: "line-slstd",
      grNumber: "1080",
      jobId: "job-131",
      partNumber: "GASKET-SET",
      description: "Flange gasket set, HP case",
      quantity: 2,
      usedQuantity: 0,
      outQuantity: 0,
      unit: "set",
      batchNumber: "G-4410",
      serialNumbers: "",
      expiryDate: "",
      condition: "NEW",
      origin: "US",
      weightKg: 0.4,
      costPerUnit: 48,
      supplierName: "Adams Aviation",
      salesOrder: "S909125",
      certificateNumber: "0007305121",
      customerOrder: "ahmed",
      invoiceReference: "S909125",
      boxId: "box-shelf1",
      assignedTo: "",
      notes: "",
    }),
    line({
      id: "line-lw032",
      grNumber: "1084",
      jobId: null,
      partNumber: "LW-032",
      alternativePartNumber: "",
      description: "Lockwire 0.032 in, stainless",
      quantity: 150,
      usedQuantity: 22,
      outQuantity: 0,
      unit: "metres",
      batchNumber: "B-6120",
      serialNumbers: "",
      expiryDate: "",
      condition: "NEW",
      origin: "US",
      weightKg: 1.2,
      costPerUnit: 0.45,
      supplierName: "Aviall Services",
      salesOrder: "S909400",
      certificateNumber: "AV-91220",
      certificateOnFile: true,
      customerOrder: "",
      invoiceReference: "INV-33610",
      boxId: "box-rack2",
      assignedTo: "",
      notes: "General stock lockwire",
      createdAt: "2026-09-11T09:30:00.000Z",
      updatedAt: "2026-09-18T10:00:00.000Z",
    }),
    line({
      id: "line-nutm8",
      grNumber: "1083",
      jobId: null,
      partNumber: "NUT-M8",
      alternativePartNumber: "",
      description: "Self-locking nut M8, A286",
      quantity: 50,
      usedQuantity: 0,
      outQuantity: 0,
      unit: "EA",
      batchNumber: "B-6000",
      serialNumbers: "",
      expiryDate: "",
      condition: "NEW",
      origin: "US",
      weightKg: 0.6,
      costPerUnit: 0.85,
      supplierName: "Adams Aviation",
      salesOrder: "S909210",
      certificateNumber: "0007306100",
      customerOrder: "",
      invoiceReference: "S909210",
      boxId: "box-shelf1",
      assignedTo: "",
      notes: "",
    }),
    line({
      id: "line-or118",
      grNumber: "1081",
      jobId: "job-128",
      partNumber: "OR-118",
      alternativePartNumber: "OR-118N",
      description: "O-ring, fuel manifold",
      quantity: 20,
      usedQuantity: 6,
      outQuantity: 2,
      unit: "EA",
      batchNumber: "B-5590",
      serialNumbers: "",
      expiryDate: "",
      condition: "NEW",
      origin: "US",
      weightKg: 0.02,
      costPerUnit: 1.85,
      supplierName: "Aviall Services",
      salesOrder: "S909125",
      certificateNumber: "AV-90118",
      certificateOnFile: true,
      customerOrder: "ahmed",
      invoiceReference: "INV-33420",
      boxId: "box-c",
      assignedTo: "Zishan Malik",
      notes: "Out with Zishan Malik for hangar fit",
      createdAt: "2026-09-08T09:02:00.000Z",
      updatedAt: "2026-09-20T10:00:00.000Z",
    }),
    line({
      id: "line-kit",
      grNumber: "975",
      jobId: "job-119",
      partNumber: "KIT-CFM56-BUILD",
      description: "Engine build consumables kit",
      quantity: 400,
      usedQuantity: 400,
      outQuantity: 0,
      unit: "grams",
      batchNumber: "A409808",
      serialNumbers: "",
      expiryDate: "",
      condition: "NEW",
      origin: "US",
      weightKg: 12,
      costPerUnit: 2.5,
      supplierName: "Adams Aviation",
      salesOrder: "S909125",
      certificateNumber: "0007305121",
      customerOrder: "ahmed",
      invoiceReference: "S909125",
      boxId: "box-2",
      assignedTo: "",
      notes: "Fitted on completed build",
      createdAt: "2026-07-02T10:00:00.000Z",
      updatedAt: "2026-08-12T10:00:00.000Z",
    }),
  ];

  // Screenshot targets: All 21 · Added 9 · Used 6 · Issued 1 · Moved to inventory 5
  const historyEvents: AeroHistoryEvent[] = [
    { id: "he-01", at: "2026-09-14T10:05:00.000Z", what: "added", lineId: "line-brg7712", partNumber: "BRG-7712", quantity: 1, jobId: "job-128", jobNumber: "WP-128", note: "GR1079 booked in" },
    { id: "he-02", at: "2026-09-14T10:20:00.000Z", what: "moved_to_inventory", lineId: "line-brg7712", partNumber: "BRG-7712", quantity: 1, jobId: "job-128", jobNumber: "WP-128", note: "Area A — Box A" },
    { id: "he-03", at: "2026-09-09T10:00:00.000Z", what: "added", lineId: "line-slstd", partNumber: "GASKET-SET", quantity: 2, jobId: "job-131", jobNumber: "WP-131", note: "GR1080 booked in" },
    { id: "he-04", at: "2026-09-02T11:05:00.000Z", what: "used", lineId: "line-bh310", partNumber: "BH-310", quantity: 4, jobId: "job-128", jobNumber: "WP-128", note: "All four fitted, none left" },
    { id: "he-05", at: "2026-09-01T08:55:00.000Z", what: "moved_to_inventory", lineId: "line-rs204", partNumber: "RS-204", quantity: 2, jobId: "job-128", jobNumber: "WP-128", note: "Area A — Box C" },
    { id: "he-06", at: "2026-08-28T10:00:00.000Z", what: "added", lineId: "line-sl103", partNumber: "SL10302-A21P", quantity: 20, jobId: "job-128", jobNumber: "WP-128", note: "GR1078 booked in" },
    { id: "he-07", at: "2026-08-28T10:30:00.000Z", what: "moved_to_inventory", lineId: "line-sl103", partNumber: "SL10302-A21P", quantity: 18, jobId: "job-128", jobNumber: "WP-128", note: "Area B — Box 2" },
    { id: "he-08", at: "2026-09-10T09:00:00.000Z", what: "added", lineId: "line-nutm8", partNumber: "NUT-M8", quantity: 50, jobId: null, jobNumber: null, note: "GR1083 shelf stock booked in" },
    { id: "he-09", at: "2026-08-26T11:00:00.000Z", what: "added", lineId: "line-bh310", partNumber: "BH-310", quantity: 4, jobId: "job-128", jobNumber: "WP-128", note: "GR1076 booked in" },
    { id: "he-10", at: "2026-08-26T09:20:00.000Z", what: "added", lineId: "line-rs204", partNumber: "RS-204", quantity: 5, jobId: "job-128", jobNumber: "WP-128", note: "GR1075 booked in" },
    { id: "he-11", at: "2026-08-26T09:12:00.000Z", what: "used", lineId: "line-rs204", partNumber: "RS-204", quantity: 1, jobId: "job-128", jobNumber: "WP-128", note: "Fitted to LP case split line" },
    { id: "he-12", at: "2026-08-26T14:00:00.000Z", what: "used", lineId: "line-rs204", partNumber: "RS-204", quantity: 2, jobId: "job-128", jobNumber: "WP-128", note: "Second fit on split line" },
    { id: "he-13", at: "2026-09-11T09:30:00.000Z", what: "added", lineId: "line-lw032", partNumber: "LW-032", quantity: 150, jobId: null, jobNumber: null, note: "GR1084 booked in as general stock" },
    { id: "he-14", at: "2026-09-11T10:00:00.000Z", what: "moved_to_inventory", lineId: "line-lw032", partNumber: "LW-032", quantity: 150, jobId: null, jobNumber: null, note: "Area B — Rack 2" },
    { id: "he-15", at: "2026-09-15T14:00:00.000Z", what: "used", lineId: "line-lw032", partNumber: "LW-032", quantity: 22, jobId: "job-131", jobNumber: "WP-131", note: "Gearbox pipework locking" },
    { id: "he-16", at: "2026-08-12T09:00:00.000Z", what: "used", lineId: "line-kit", partNumber: "KIT-CFM56-BUILD", quantity: 400, jobId: "job-119", jobNumber: "WP-119", note: "Build kit consumed" },
    { id: "he-17", at: "2026-09-20T09:15:00.000Z", what: "issued", lineId: "line-or118", partNumber: "OR-118", quantity: 2, jobId: "job-128", jobNumber: "WP-128", note: "Out with Zishan Malik" },
    { id: "he-18", at: "2026-09-08T09:02:00.000Z", what: "added", lineId: "line-or118", partNumber: "OR-118", quantity: 20, jobId: "job-128", jobNumber: "WP-128", note: "GR1081 booked in" },
    { id: "he-19", at: "2026-09-08T10:00:00.000Z", what: "moved_to_inventory", lineId: "line-or118", partNumber: "OR-118", quantity: 20, jobId: "job-128", jobNumber: "WP-128", note: "Area A — Box C" },
    { id: "he-20", at: "2026-09-12T11:00:00.000Z", what: "used", lineId: "line-or118", partNumber: "OR-118", quantity: 6, jobId: "job-128", jobNumber: "WP-128", note: "Fitted on fuel manifold" },
    { id: "he-21", at: "2026-07-02T10:00:00.000Z", what: "added", lineId: "line-kit", partNumber: "KIT-CFM56-BUILD", quantity: 400, jobId: "job-119", jobNumber: "WP-119", note: "GR975 booked in" },
  ];

  await db.transaction(
    "rw",
    [db.users, db.jobs, db.boxes, db.receiptLines, db.historyEvents, db.settings],
    async () => {
      await db.users.clear();
      await db.jobs.clear();
      await db.boxes.clear();
      await db.receiptLines.clear();
      await db.historyEvents.clear();
      await db.settings.clear();
      await db.users.add(user);
      await db.jobs.bulkAdd(jobs);
      await db.boxes.bulkAdd(boxes);
      await db.receiptLines.bulkAdd(receiptLines);
      await db.historyEvents.bulkAdd(historyEvents);
      await db.settings.put(settings);
    },
  );
}

export { DEMO as AERO_DEMO_LOGIN };
