import Dexie, { type EntityTable, type Table } from "dexie";
import type {
  ActivityLog,
  AlternatePartNumber,
  AppSettings,
  Costing,
  DocumentRecord,
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

export class InventoryDatabase extends Dexie {
  users!: EntityTable<User, "id">;
  parts!: EntityTable<Part, "id">;
  alternatePartNumbers!: EntityTable<AlternatePartNumber, "id">;
  suppliers!: EntityTable<Supplier, "id">;
  locations!: EntityTable<Location, "id">;
  grns!: EntityTable<Grn, "id">;
  grnItems!: EntityTable<GrnItem, "id">;
  workpacks!: EntityTable<Workpack, "id">;
  stockMovements!: EntityTable<StockMovement, "id">;
  costings!: EntityTable<Costing, "id">;
  pricingRules!: EntityTable<PricingRule, "id">;
  documents!: EntityTable<DocumentRecord, "id">;
  activityLogs!: EntityTable<ActivityLog, "id">;
  settings!: Table<AppSettings, string>;

  constructor() {
    super("ash-aviation-inventory");
    this.version(1).stores({
      users: "id, email, role",
      parts: "id, partNumber, status, category, description",
      alternatePartNumbers: "id, partId, alternateNumber",
      suppliers: "id, name, status",
      locations: "id, code, name, status",
      grns: "id, grnNumber, supplierId, date, status, workpackId",
      grnItems: "id, grnId, partId, workpackId, locationId, serialNumber",
      workpacks: "id, workpackNumber, status, registration",
      stockMovements: "id, partId, type, date, grnId, workpackId, locationId, grnItemId",
      costings: "id, grnId, grnItemId, partId, pricingMethod",
      pricingRules: "id, priority, active",
      documents: "id, entityType, entityId, type",
      activityLogs: "id, date, entityType, entityId, action, userId",
      settings: "id",
    });
  }
}

let dbInstance: InventoryDatabase | null = null;

export function getDb() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  if (!dbInstance) {
    dbInstance = new InventoryDatabase();
  }
  return dbInstance;
}

export async function resetDatabase() {
  const db = getDb();
  await db.delete();
  dbInstance = null;
  return getDb();
}
