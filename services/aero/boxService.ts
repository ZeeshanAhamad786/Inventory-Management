import { createId, nowIso } from "@/lib/utils";
import type { AeroBox } from "@/types/aeroswift";
import { getDb } from "@/db/aero-db";

export const boxService = {
  async list() {
    return getDb().boxes.filter((b) => b.active).toArray();
  },

  async create(input: { name: string; code: string; area: string; description: string; active?: boolean }) {
    const timestamp = nowIso();
    const row: AeroBox = {
      id: createId(),
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      area: input.area.trim(),
      description: input.description.trim(),
      active: input.active ?? true,
      createdAt: timestamp,
    };
    await getDb().boxes.add(row);
    return row;
  },
};
