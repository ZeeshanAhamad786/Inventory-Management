import { COMPANY_DEFAULT_NAME, DEMO_LOGIN } from "@/lib/constants";
import { createId, nowIso, roundMoney } from "@/lib/utils";
import { applyPricingRule, calculateCostingFigures } from "@/lib/pricing";
import type {
  ActivityLog,
  AlternatePartNumber,
  AppSettings,
  Costing,
  Grn,
  GrnItem,
  Location,
  Part,
  PricingRule,
  StockMovement,
  Supplier,
  User,
  Workpack,
} from "@/types";
import { getDb } from "./db";

const FIXED = {
  admin: "user-admin",
  adams: "sup-adams",
  airpart: "sup-airpart",
  ash1: "loc-ash1",
  ash2: "loc-ash2",
  ash3: "loc-ash3",
  paint: "loc-paint",
  job10: "wp-job10",
  job47: "wp-job47",
  job80: "wp-job80",
  job123: "wp-job123",
  sam6791: "wp-sam6791",
};

function iso(date: string) {
  return new Date(`${date}T10:00:00`).toISOString();
}

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

  const admin: User = {
    id: FIXED.admin,
    email: DEMO_LOGIN.email,
    name: "Stores Admin",
    role: "admin",
    password: DEMO_LOGIN.password,
    active: true,
    createdAt,
    updatedAt: createdAt,
  };

  const settings: AppSettings = {
    id: "app",
    companyName: COMPANY_DEFAULT_NAME,
    companyAddress: "Hangar 4, Ashford Aerodrome, Kent TN24 8AE",
    companyPhone: "01233 555 140",
    companyEmail: "stores@ashaviation.example",
    grnPrefix: "GR",
    autoGrnNumber: true,
    nextGrnSequence: 26734,
    updatedAt: createdAt,
  };

  const suppliers: Supplier[] = [
    {
      id: FIXED.adams,
      name: "Adams",
      contactPerson: "Claire Adams",
      email: "sales@adams-aero.example",
      phone: "01622 441 200",
      address: "Unit 12, Maidstone Industrial Estate, Kent",
      notes: "Primary fastener and hardware supplier.",
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: FIXED.airpart,
      name: "Airpart",
      contactPerson: "James Cole",
      email: "accounts@airpart.example",
      phone: "01279 833 200",
      address: "Stansted Aviation Park, Essex",
      notes: "Filters, fluids and ignition parts.",
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const locations: Location[] = [
    { id: FIXED.ash1, name: "ASH BOX 1", code: "ASH1", description: "Main fastener bin", status: "active", createdAt, updatedAt: createdAt },
    { id: FIXED.ash2, name: "ASH BOX 2", code: "ASH2", description: "Washer and hardware bin", status: "active", createdAt, updatedAt: createdAt },
    { id: FIXED.ash3, name: "ASH BOX 3", code: "ASH3", description: "Overflow hardware", status: "active", createdAt, updatedAt: createdAt },
    { id: FIXED.paint, name: "Paint Room", code: "PAINT", description: "Consumables and fluids", status: "active", createdAt, updatedAt: createdAt },
  ];

  const workpacks: Workpack[] = [
    {
      id: FIXED.job10,
      workpackNumber: "JOB 10",
      title: "Annual inspection – G-ICRM",
      registration: "G-ICRM",
      status: "in_progress",
      startDate: iso("2026-02-12"),
      completionDate: null,
      notes: "Phase 1 inspection workpack.",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: FIXED.job47,
      workpackNumber: "JOB 47",
      title: "Landing gear hardware replacement",
      registration: "G-BKTH",
      status: "open",
      startDate: iso("2026-04-03"),
      completionDate: null,
      notes: "",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: FIXED.job80,
      workpackNumber: "JOB 80",
      title: "Engine filter and fluid service",
      registration: "G-ICRM",
      status: "completed",
      startDate: iso("2025-11-18"),
      completionDate: iso("2025-12-02"),
      notes: "Closed after engine bay service.",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: FIXED.job123,
      workpackNumber: "JOB 123",
      title: "Avionics tray fastener batch",
      registration: "G-OASH",
      status: "open",
      startDate: iso("2026-06-01"),
      completionDate: null,
      notes: "",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: FIXED.sam6791,
      workpackNumber: "SAM6791",
      title: "Print sheet workpack SAM6791",
      registration: "G-ICRM",
      status: "in_progress",
      startDate: iso("2026-03-20"),
      completionDate: null,
      notes: "Matches historic print sheet metadata.",
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const partsSeed: Array<Part & { alternates: string[] }> = [
    { id: "part-nas0463", partNumber: "NAS1149F0463P", description: "Plain Washer", category: "Washers", unitOfMeasure: "EA", defaultCost: 0.18, defaultSalePrice: 0.54, status: "active", notes: "Common AN960 equivalent washer.", createdAt, updatedAt: createdAt, alternates: ["STD-8", "AN960-416"] },
    { id: "part-nas0563", partNumber: "NAS1149F0563P", description: "Plain Washer", category: "Washers", unitOfMeasure: "EA", defaultCost: 0.22, defaultSalePrice: 0.66, status: "active", notes: "", createdAt, updatedAt: createdAt, alternates: ["AN960-516"] },
    { id: "part-an960", partNumber: "AN960-616", description: "Plain Washer", category: "Washers", unitOfMeasure: "EA", defaultCost: 0.25, defaultSalePrice: 0.75, status: "active", notes: "", createdAt, updatedAt: createdAt, alternates: [] },
    { id: "part-ms12", partNumber: "MS90725-12", description: "Bolt", category: "Bolts", unitOfMeasure: "EA", defaultCost: 1.15, defaultSalePrice: 3.45, status: "active", notes: "", createdAt, updatedAt: createdAt, alternates: [] },
    { id: "part-ms9", partNumber: "MS90725-9", description: "Bolt", category: "Bolts", unitOfMeasure: "EA", defaultCost: 0.95, defaultSalePrice: 2.85, status: "active", notes: "", createdAt, updatedAt: createdAt, alternates: [] },
    { id: "part-lw25", partNumber: "LW-25-0.94", description: "Lock Washer", category: "Washers", unitOfMeasure: "EA", defaultCost: 0.42, defaultSalePrice: 1.26, status: "active", notes: "", createdAt, updatedAt: createdAt, alternates: [] },
    { id: "part-ms40", partNumber: "MS35333-40", description: "Lock Washer", category: "Washers", unitOfMeasure: "EA", defaultCost: 0.31, defaultSalePrice: 0.93, status: "active", notes: "", createdAt, updatedAt: createdAt, alternates: [] },
    { id: "part-ms41", partNumber: "MS35333-41", description: "Lock Washer", category: "Washers", unitOfMeasure: "EA", defaultCost: 0.33, defaultSalePrice: 0.99, status: "active", notes: "", createdAt, updatedAt: createdAt, alternates: [] },
    { id: "part-ms42", partNumber: "MS35333-42P", description: "Lock Washer", category: "Washers", unitOfMeasure: "EA", defaultCost: 0.36, defaultSalePrice: 1.08, status: "active", notes: "", createdAt, updatedAt: createdAt, alternates: [] },
    { id: "part-sl116", partNumber: "SL11625", description: "Oil Filter", category: "Filters", unitOfMeasure: "EA", defaultCost: 18.5, defaultSalePrice: 25.16, status: "active", notes: "", createdAt, updatedAt: createdAt, alternates: ["CH48110"] },
    { id: "part-sl121", partNumber: "SL12186", description: "Air Filter", category: "Filters", unitOfMeasure: "EA", defaultCost: 22.4, defaultSalePrice: 30.24, status: "active", notes: "", createdAt, updatedAt: createdAt, alternates: [] },
    { id: "part-sl155", partNumber: "SL15592-5-05", description: "Seal", category: "Seals", unitOfMeasure: "EA", defaultCost: 6.75, defaultSalePrice: 11.81, status: "active", notes: "", createdAt, updatedAt: createdAt, alternates: [] },
    { id: "part-spark", partNumber: "REM38E", description: "Spark Plug", category: "Ignition", unitOfMeasure: "EA", defaultCost: 27, defaultSalePrice: 36.45, status: "active", notes: "Champion REM38E equivalent.", createdAt, updatedAt: createdAt, alternates: ["URHB32E"] },
    { id: "part-hyd", partNumber: "HYD-5606-1L", description: "Hyd Oil", category: "Fluids", unitOfMeasure: "LTR", defaultCost: 8.9, defaultSalePrice: 15.58, status: "active", notes: "MIL-PRF-5606 equivalent.", createdAt, updatedAt: createdAt, alternates: [] },
    { id: "part-ms123", partNumber: "MS123", description: "Inspection Hardware Set", category: "Hardware", unitOfMeasure: "EA", defaultCost: 20, defaultSalePrice: 27, status: "active", notes: "Used in the demo workflow example.", createdAt, updatedAt: createdAt, alternates: ["ALT-123"] },
  ];

  const parts: Part[] = partsSeed.map((part) => ({
    id: part.id,
    partNumber: part.partNumber,
    description: part.description,
    category: part.category,
    unitOfMeasure: part.unitOfMeasure,
    defaultCost: part.defaultCost,
    defaultSalePrice: part.defaultSalePrice,
    status: part.status,
    notes: part.notes,
    createdAt: part.createdAt,
    updatedAt: part.updatedAt,
  }));
  const alternates: AlternatePartNumber[] = partsSeed.flatMap((part) =>
    part.alternates.map((alternateNumber) => ({
      id: createId(),
      partId: part.id,
      alternateNumber,
      notes: "",
      createdAt,
    })),
  );

  const pricingRules: PricingRule[] = [
    { id: "pr-1", label: "Under £1 × 3.00", minCost: 0, maxCost: 1, multiplier: 3, isPoa: false, active: true, priority: 1, createdAt, updatedAt: createdAt },
    { id: "pr-2", label: "Under £5 × 1.75", minCost: 1, maxCost: 5, multiplier: 1.75, isPoa: false, active: true, priority: 2, createdAt, updatedAt: createdAt },
    { id: "pr-3", label: "Under £10 × 1.45", minCost: 5, maxCost: 10, multiplier: 1.45, isPoa: false, active: true, priority: 3, createdAt, updatedAt: createdAt },
    { id: "pr-4", label: "Under £25 × 1.35", minCost: 10, maxCost: 25, multiplier: 1.35, isPoa: false, active: true, priority: 4, createdAt, updatedAt: createdAt },
    { id: "pr-5", label: "Under £50 × 1.30", minCost: 25, maxCost: 50, multiplier: 1.3, isPoa: false, active: true, priority: 5, createdAt, updatedAt: createdAt },
    { id: "pr-6", label: "Under £100 × 1.20", minCost: 50, maxCost: 100, multiplier: 1.2, isPoa: false, active: true, priority: 6, createdAt, updatedAt: createdAt },
    { id: "pr-7", label: "Under £250 × 1.18", minCost: 100, maxCost: 250, multiplier: 1.18, isPoa: false, active: true, priority: 7, createdAt, updatedAt: createdAt },
    { id: "pr-8", label: "Under £500 × 1.15", minCost: 250, maxCost: 500, multiplier: 1.15, isPoa: false, active: true, priority: 8, createdAt, updatedAt: createdAt },
    { id: "pr-9", label: "£500 and above – POA", minCost: 500, maxCost: null, multiplier: null, isPoa: true, active: true, priority: 9, createdAt, updatedAt: createdAt },
  ];

  type GrnSeed = {
    grn: Grn;
    items: Array<Omit<GrnItem, "createdAt" | "updatedAt"> & { issueQty?: number }>;
  };

  const grnSeeds: GrnSeed[] = [
    {
      grn: {
        id: "grn-gr1",
        grnNumber: "GR1",
        date: iso("2025-09-18"),
        supplierId: FIXED.adams,
        invoice: "AD-10412",
        supplierTrackingReference: "TRK-8811",
        supplierBatchNumber: "BCH-441",
        workpackId: FIXED.job10,
        registration: "G-ICRM",
        sheetNumber: 1,
        totalSheets: 1,
        notes: "First historic washer receipt.",
        status: "received",
        createdBy: FIXED.admin,
        createdAt: iso("2025-09-18"),
        updatedAt: iso("2025-09-18"),
      },
      items: [
        {
          id: "gi-gr1-1",
          grnId: "grn-gr1",
          lineNumber: 1,
          partId: "part-nas0463",
          alternatePartNumber: "STD-8 & AN960-416",
          serialNumber: "",
          description: "Plain Washer",
          quantity: 200,
          supplierBatchNumber: "BCH-441",
          purchaseCostEa: 0.18,
          locationId: FIXED.ash2,
          workpackId: FIXED.job10,
          notes: "",
          issueQty: 40,
        },
      ],
    },
    {
      grn: {
        id: "grn-gr2",
        grnNumber: "GR2",
        date: iso("2025-10-02"),
        supplierId: FIXED.adams,
        invoice: "AD-10501",
        supplierTrackingReference: "TRK-8904",
        supplierBatchNumber: "BCH-502",
        workpackId: FIXED.job47,
        registration: "G-BKTH",
        sheetNumber: 1,
        totalSheets: 1,
        notes: "",
        status: "received",
        createdBy: FIXED.admin,
        createdAt: iso("2025-10-02"),
        updatedAt: iso("2025-10-02"),
      },
      items: [
        {
          id: "gi-gr2-1",
          grnId: "grn-gr2",
          lineNumber: 1,
          partId: "part-nas0463",
          alternatePartNumber: "AN960-416",
          serialNumber: "",
          description: "Plain Washer",
          quantity: 80,
          supplierBatchNumber: "BCH-502",
          purchaseCostEa: 0.19,
          locationId: FIXED.ash2,
          workpackId: FIXED.job47,
          notes: "Second receipt of the same P/N – keep historically separate.",
        },
      ],
    },
    {
      grn: {
        id: "grn-10-11",
        grnNumber: "GR10-11",
        date: iso("2025-11-14"),
        supplierId: FIXED.adams,
        invoice: "AD-10880",
        supplierTrackingReference: "DPD-22019",
        supplierBatchNumber: "BCH-611",
        workpackId: FIXED.job47,
        registration: "G-BKTH",
        sheetNumber: 1,
        totalSheets: 1,
        notes: "Multi-item GRN.",
        status: "received",
        createdBy: FIXED.admin,
        createdAt: iso("2025-11-14"),
        updatedAt: iso("2025-11-14"),
      },
      items: [
        {
          id: "gi-1011-1",
          grnId: "grn-10-11",
          lineNumber: 1,
          partId: "part-ms42",
          alternatePartNumber: "",
          serialNumber: "",
          description: "Lock Washer",
          quantity: 150,
          supplierBatchNumber: "BCH-611",
          purchaseCostEa: 0.36,
          locationId: FIXED.ash1,
          workpackId: FIXED.job47,
          notes: "",
          issueQty: 12,
        },
        {
          id: "gi-1011-2",
          grnId: "grn-10-11",
          lineNumber: 2,
          partId: "part-ms41",
          alternatePartNumber: "",
          serialNumber: "",
          description: "Lock Washer",
          quantity: 120,
          supplierBatchNumber: "BCH-611",
          purchaseCostEa: 0.33,
          locationId: FIXED.ash1,
          workpackId: FIXED.job47,
          notes: "",
        },
      ],
    },
    {
      grn: {
        id: "grn-187",
        grnNumber: "GR187-196",
        date: iso("2026-01-09"),
        supplierId: FIXED.adams,
        invoice: "AD-11220",
        supplierTrackingReference: "TRK-9912",
        supplierBatchNumber: "BCH-720",
        workpackId: FIXED.job10,
        registration: "G-ICRM",
        sheetNumber: 1,
        totalSheets: 1,
        notes: "",
        status: "received",
        createdBy: FIXED.admin,
        createdAt: iso("2026-01-09"),
        updatedAt: iso("2026-01-09"),
      },
      items: [
        {
          id: "gi-187-1",
          grnId: "grn-187",
          lineNumber: 1,
          partId: "part-ms12",
          alternatePartNumber: "",
          serialNumber: "",
          description: "Bolt",
          quantity: 40,
          supplierBatchNumber: "BCH-720",
          purchaseCostEa: 1.15,
          locationId: FIXED.ash1,
          workpackId: FIXED.job10,
          notes: "",
          issueQty: 6,
        },
        {
          id: "gi-187-2",
          grnId: "grn-187",
          lineNumber: 2,
          partId: "part-ms9",
          alternatePartNumber: "",
          serialNumber: "",
          description: "Bolt",
          quantity: 55,
          supplierBatchNumber: "BCH-720",
          purchaseCostEa: 0.95,
          locationId: FIXED.ash1,
          workpackId: FIXED.job10,
          notes: "",
        },
        {
          id: "gi-187-3",
          grnId: "grn-187",
          lineNumber: 3,
          partId: "part-lw25",
          alternatePartNumber: "",
          serialNumber: "",
          description: "Lock Washer",
          quantity: 60,
          supplierBatchNumber: "BCH-720",
          purchaseCostEa: 0.42,
          locationId: FIXED.ash2,
          workpackId: FIXED.job10,
          notes: "",
        },
      ],
    },
    {
      grn: {
        id: "grn-259",
        grnNumber: "GR259-98",
        date: iso("2026-02-21"),
        supplierId: FIXED.airpart,
        invoice: "AP-4401",
        supplierTrackingReference: "UPS-33190",
        supplierBatchNumber: "AP-98",
        workpackId: FIXED.job80,
        registration: "G-ICRM",
        sheetNumber: 1,
        totalSheets: 1,
        notes: "Engine bay service parts.",
        status: "received",
        createdBy: FIXED.admin,
        createdAt: iso("2026-02-21"),
        updatedAt: iso("2026-02-21"),
      },
      items: [
        {
          id: "gi-259-1",
          grnId: "grn-259",
          lineNumber: 1,
          partId: "part-sl116",
          alternatePartNumber: "CH48110",
          serialNumber: "OF-44012",
          description: "Oil Filter",
          quantity: 6,
          supplierBatchNumber: "AP-98",
          purchaseCostEa: 18.5,
          locationId: FIXED.paint,
          workpackId: FIXED.job80,
          notes: "",
          issueQty: 2,
        },
        {
          id: "gi-259-2",
          grnId: "grn-259",
          lineNumber: 2,
          partId: "part-hyd",
          alternatePartNumber: "",
          serialNumber: "",
          description: "Hyd Oil",
          quantity: 8,
          supplierBatchNumber: "AP-98",
          purchaseCostEa: 8.9,
          locationId: FIXED.paint,
          workpackId: FIXED.job80,
          notes: "",
          issueQty: 2,
        },
      ],
    },
    {
      grn: {
        id: "grn-965",
        grnNumber: "GR965-1046",
        date: iso("2026-04-16"),
        supplierId: FIXED.adams,
        invoice: "AD-11890",
        supplierTrackingReference: "TRK-1046",
        supplierBatchNumber: "BCH-965",
        workpackId: FIXED.job123,
        registration: "G-OASH",
        sheetNumber: 1,
        totalSheets: 1,
        notes: "",
        status: "received",
        createdBy: FIXED.admin,
        createdAt: iso("2026-04-16"),
        updatedAt: iso("2026-04-16"),
      },
      items: [
        {
          id: "gi-965-1",
          grnId: "grn-965",
          lineNumber: 1,
          partId: "part-nas0563",
          alternatePartNumber: "AN960-516",
          serialNumber: "",
          description: "Plain Washer",
          quantity: 300,
          supplierBatchNumber: "BCH-965",
          purchaseCostEa: 0.22,
          locationId: FIXED.ash2,
          workpackId: FIXED.job123,
          notes: "",
        },
        {
          id: "gi-965-2",
          grnId: "grn-965",
          lineNumber: 2,
          partId: "part-an960",
          alternatePartNumber: "",
          serialNumber: "",
          description: "Plain Washer",
          quantity: 180,
          supplierBatchNumber: "BCH-965",
          purchaseCostEa: 0.25,
          locationId: FIXED.ash2,
          workpackId: FIXED.job123,
          notes: "",
        },
        {
          id: "gi-965-3",
          grnId: "grn-965",
          lineNumber: 3,
          partId: "part-ms40",
          alternatePartNumber: "",
          serialNumber: "",
          description: "Lock Washer",
          quantity: 90,
          supplierBatchNumber: "BCH-965",
          purchaseCostEa: 0.31,
          locationId: FIXED.ash3,
          workpackId: FIXED.job123,
          notes: "",
        },
      ],
    },
    {
      grn: {
        id: "grn-1047",
        grnNumber: "GR1047-1059",
        date: iso("2026-05-28"),
        supplierId: FIXED.airpart,
        invoice: "AP-4788",
        supplierTrackingReference: "DHL-77821",
        supplierBatchNumber: "AP-1059",
        workpackId: FIXED.sam6791,
        registration: "G-ICRM",
        sheetNumber: 1,
        totalSheets: 1,
        notes: "Print sheet style costing batch.",
        status: "received",
        createdBy: FIXED.admin,
        createdAt: iso("2026-05-28"),
        updatedAt: iso("2026-05-28"),
      },
      items: [
        {
          id: "gi-1047-1",
          grnId: "grn-1047",
          lineNumber: 1,
          partId: "part-spark",
          alternatePartNumber: "URHB32E",
          serialNumber: "SP-2291",
          description: "Spark Plug",
          quantity: 8,
          supplierBatchNumber: "AP-1059",
          purchaseCostEa: 27,
          locationId: FIXED.paint,
          workpackId: FIXED.sam6791,
          notes: "",
        },
        {
          id: "gi-1047-2",
          grnId: "grn-1047",
          lineNumber: 2,
          partId: "part-sl121",
          alternatePartNumber: "",
          serialNumber: "AF-1182",
          description: "Air Filter",
          quantity: 4,
          supplierBatchNumber: "AP-1059",
          purchaseCostEa: 22.4,
          locationId: FIXED.paint,
          workpackId: FIXED.sam6791,
          notes: "",
        },
        {
          id: "gi-1047-3",
          grnId: "grn-1047",
          lineNumber: 3,
          partId: "part-sl155",
          alternatePartNumber: "",
          serialNumber: "",
          description: "Seal",
          quantity: 12,
          supplierBatchNumber: "AP-1059",
          purchaseCostEa: 6.75,
          locationId: FIXED.ash3,
          workpackId: FIXED.sam6791,
          notes: "",
        },
      ],
    },
    {
      grn: {
        id: "grn-26733",
        grnNumber: "GR26733",
        date: iso("2026-07-11"),
        supplierId: FIXED.airpart,
        invoice: "AP-5022",
        supplierTrackingReference: "TRK-26733",
        supplierBatchNumber: "AP-733",
        workpackId: FIXED.job80,
        registration: "G-ICRM",
        sheetNumber: 1,
        totalSheets: 1,
        notes: "Batch costing example GRN.",
        status: "received",
        createdBy: FIXED.admin,
        createdAt: iso("2026-07-11"),
        updatedAt: iso("2026-07-11"),
      },
      items: [
        {
          id: "gi-26733-1",
          grnId: "grn-26733",
          lineNumber: 1,
          partId: "part-spark",
          alternatePartNumber: "URHB32E",
          serialNumber: "SP-3301",
          description: "Spark Plug",
          quantity: 4,
          supplierBatchNumber: "AP-733",
          purchaseCostEa: 27,
          locationId: FIXED.paint,
          workpackId: FIXED.job80,
          notes: "",
        },
        {
          id: "gi-26733-2",
          grnId: "grn-26733",
          lineNumber: 2,
          partId: "part-sl121",
          alternatePartNumber: "",
          serialNumber: "",
          description: "Air Filter",
          quantity: 2,
          supplierBatchNumber: "AP-733",
          purchaseCostEa: 22.4,
          locationId: FIXED.paint,
          workpackId: FIXED.job80,
          notes: "",
        },
        {
          id: "gi-26733-3",
          grnId: "grn-26733",
          lineNumber: 3,
          partId: "part-nas0463",
          alternatePartNumber: "STD-8",
          serialNumber: "",
          description: "Plain Washer",
          quantity: 50,
          supplierBatchNumber: "AP-733",
          purchaseCostEa: 0.18,
          locationId: FIXED.ash2,
          workpackId: FIXED.job80,
          notes: "",
        },
      ],
    },
  ];

  const grns = grnSeeds.map((seed) => seed.grn);
  const grnItems: GrnItem[] = [];
  const movements: StockMovement[] = [];
  const costings: Costing[] = [];
  const logs: ActivityLog[] = [
    {
      id: createId(),
      userId: FIXED.admin,
      userName: admin.name,
      action: "imported",
      entityType: "settings",
      entityId: "app",
      reference: "SEED",
      description: "Demo data seeded from historic Excel-style aviation stores records.",
      date: createdAt,
    },
  ];

  for (const seed of grnSeeds) {
    logs.push({
      id: createId(),
      userId: FIXED.admin,
      userName: admin.name,
      action: "created",
      entityType: "grn",
      entityId: seed.grn.id,
      reference: seed.grn.grnNumber,
      description: `Created GRN ${seed.grn.grnNumber}`,
      date: seed.grn.createdAt,
    });

    for (const item of seed.items) {
      const { issueQty, ...rest } = item;
      const grnItem: GrnItem = {
        ...rest,
        createdAt: seed.grn.createdAt,
        updatedAt: seed.grn.updatedAt,
      };
      grnItems.push(grnItem);
      movements.push({
        id: createId(),
        partId: grnItem.partId,
        quantityChange: grnItem.quantity,
        type: "RECEIPT",
        referenceType: "grn",
        referenceId: seed.grn.id,
        grnId: seed.grn.id,
        grnItemId: grnItem.id,
        workpackId: grnItem.workpackId,
        locationId: grnItem.locationId,
        date: seed.grn.date,
        userId: FIXED.admin,
        notes: `Received on ${seed.grn.grnNumber}`,
        createdAt: seed.grn.createdAt,
      });

      if (issueQty && issueQty > 0) {
        movements.push({
          id: createId(),
          partId: grnItem.partId,
          quantityChange: -issueQty,
          type: "ISSUE",
          referenceType: "workpack",
          referenceId: grnItem.workpackId ?? seed.grn.workpackId ?? seed.grn.id,
          grnId: seed.grn.id,
          grnItemId: grnItem.id,
          workpackId: grnItem.workpackId,
          locationId: grnItem.locationId,
          date: seed.grn.date,
          userId: FIXED.admin,
          notes: `Issued to ${workpacks.find((w) => w.id === grnItem.workpackId)?.workpackNumber ?? "job"}`,
          createdAt: seed.grn.createdAt,
        });
      }

      const pricing = applyPricingRule(grnItem.purchaseCostEa, pricingRules);
      const method = pricing.method === "POA" ? "POA" : "AUTOMATIC";
      const figures = calculateCostingFigures({
        quantity: grnItem.quantity,
        purchaseCostEa: grnItem.purchaseCostEa,
        pricingMethod: method,
        salePriceEa: pricing.salePriceEa,
      });
      costings.push({
        id: createId(),
        grnId: seed.grn.id,
        grnItemId: grnItem.id,
        partId: grnItem.partId,
        quantity: grnItem.quantity,
        purchaseCostEa: grnItem.purchaseCostEa,
        totalCost: figures.totalCost,
        pricingMethod: method,
        pricingRuleId: pricing.ruleId,
        salePriceEa: figures.totalSale === null ? null : pricing.salePriceEa,
        totalSale: figures.totalSale,
        profit: figures.profit,
        profitPercent: figures.profitPercent,
        notes: "",
        createdBy: FIXED.admin,
        createdAt: seed.grn.createdAt,
        updatedAt: seed.grn.updatedAt,
      });
    }
  }

  movements.push({
    id: createId(),
    partId: "part-nas0463",
    quantityChange: -5,
    type: "ADJUSTMENT_OUT",
    referenceType: "stock_movement",
    referenceId: "adj-nas0463",
    grnId: null,
    grnItemId: null,
    workpackId: null,
    locationId: FIXED.ash2,
    date: iso("2026-03-01"),
    userId: FIXED.admin,
    notes: "Stocktake adjustment",
    createdAt: iso("2026-03-01"),
  });

  await db.transaction(
    "rw",
    [
      db.users,
      db.settings,
      db.suppliers,
      db.locations,
      db.workpacks,
      db.parts,
      db.alternatePartNumbers,
      db.pricingRules,
      db.grns,
      db.grnItems,
      db.stockMovements,
      db.costings,
      db.activityLogs,
    ],
    async () => {
      await db.users.bulkAdd([admin]);
      await db.settings.put(settings);
      await db.suppliers.bulkAdd(suppliers);
      await db.locations.bulkAdd(locations);
      await db.workpacks.bulkAdd(workpacks);
      await db.parts.bulkAdd(parts);
      await db.alternatePartNumbers.bulkAdd(alternates);
      await db.pricingRules.bulkAdd(pricingRules);
      await db.grns.bulkAdd(grns);
      await db.grnItems.bulkAdd(grnItems);
      await db.stockMovements.bulkAdd(movements);
      await db.costings.bulkAdd(costings);
      await db.activityLogs.bulkAdd(logs);
    },
  );

  return { parts: parts.length, grns: grns.length, items: grnItems.length };
}

export { roundMoney };
