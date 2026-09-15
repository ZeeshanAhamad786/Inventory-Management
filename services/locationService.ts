import { getDb } from "@/db/db";
import { locationSchema, type LocationFormValues } from "@/schemas";
import { createId, nowIso } from "@/lib/utils";
import type { Location } from "@/types";
import { activityService } from "./activityService";

export const locationService = {
  async list() {
    return getDb().locations.orderBy("name").toArray();
  },

  async get(id: string) {
    return getDb().locations.get(id);
  },

  async create(values: LocationFormValues) {
    const parsed = locationSchema.parse(values);
    const timestamp = nowIso();
    const location: Location = {
      id: createId(),
      name: parsed.name.trim(),
      code: parsed.code.trim().toUpperCase(),
      description: parsed.description,
      status: parsed.status,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await getDb().locations.add(location);
    await activityService.log({
      action: "created",
      entityType: "location",
      entityId: location.id,
      reference: location.name,
      description: `Created location ${location.name}`,
    });
    return location;
  },

  async update(id: string, values: LocationFormValues) {
    const parsed = locationSchema.parse(values);
    const current = await this.get(id);
    if (!current) throw new Error("Location not found");
    const next: Location = {
      ...current,
      ...parsed,
      name: parsed.name.trim(),
      code: parsed.code.trim().toUpperCase(),
      updatedAt: nowIso(),
    };
    await getDb().locations.put(next);
    await activityService.log({
      action: "updated",
      entityType: "location",
      entityId: id,
      reference: next.name,
      description: `Updated location ${next.name}`,
    });
    return next;
  },
};
