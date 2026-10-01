import Dexie, { type EntityTable, type Table } from "dexie";
import type { AeroBox, AeroHistoryEvent, AeroJob, AeroReceiptLine, AeroSettings, AeroUser } from "@/types/aeroswift";

export class AeroswiftDatabase extends Dexie {
  users!: EntityTable<AeroUser, "id">;
  jobs!: EntityTable<AeroJob, "id">;
  boxes!: EntityTable<AeroBox, "id">;
  receiptLines!: EntityTable<AeroReceiptLine, "id">;
  historyEvents!: EntityTable<AeroHistoryEvent, "id">;
  settings!: Table<AeroSettings, string>;

  constructor() {
    super("aeroswift-parts-control-v12");
    this.version(1).stores({
      users: "id, email",
      jobs: "id, jobNumber, status, registration",
      boxes: "id, code, name",
      receiptLines: "id, grNumber, jobId, partNumber, status, boxId, assignedTo",
      historyEvents: "id, at, what, lineId, partNumber, jobId",
      settings: "id",
    });
  }
}

let dbInstance: AeroswiftDatabase | null = null;

export function getDb() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  if (!dbInstance) {
    dbInstance = new AeroswiftDatabase();
  }
  return dbInstance;
}

export async function resetAeroswiftDatabase() {
  const db = getDb();
  await db.delete();
  dbInstance = null;
  return getDb();
}
