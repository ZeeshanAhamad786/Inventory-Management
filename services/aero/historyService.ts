import type { AeroHistoryEvent, HistoryWhat } from "@/types/aeroswift";
import { getDb } from "@/db/aero-db";

export const HISTORY_FILTERS: Array<{ key: "all" | HistoryWhat; label: string }> = [
  { key: "all", label: "All" },
  { key: "added", label: "Added" },
  { key: "used", label: "Used" },
  { key: "issued", label: "Issued" },
  { key: "moved_to_inventory", label: "Moved to inventory" },
];

export function historyWhatLabel(what: HistoryWhat) {
  switch (what) {
    case "added":
      return "Added";
    case "used":
      return "Used";
    case "issued":
      return "Issued";
    case "moved_to_inventory":
      return "Moved to inventory";
  }
}

export const historyService = {
  async list() {
    return getDb().historyEvents.orderBy("at").reverse().toArray();
  },

  async listForLine(lineId: string) {
    const rows = await getDb().historyEvents.where("lineId").equals(lineId).toArray();
    return rows.sort((a, b) => b.at.localeCompare(a.at));
  },

  async counts() {
    const events = await this.list();
    return {
      all: events.length,
      added: events.filter((e) => e.what === "added").length,
      used: events.filter((e) => e.what === "used").length,
      issued: events.filter((e) => e.what === "issued").length,
      moved_to_inventory: events.filter((e) => e.what === "moved_to_inventory").length,
    };
  },

  async filtered(what: "all" | HistoryWhat) {
    const events = await this.list();
    if (what === "all") return events;
    return events.filter((e) => e.what === what);
  },
};

export type { AeroHistoryEvent };
