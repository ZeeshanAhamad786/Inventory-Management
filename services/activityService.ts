import { getDb } from "@/db/db";
import { createId, nowIso } from "@/lib/utils";
import type { ActivityAction, ActivityLog, EntityType } from "@/types";
import { getServiceUser } from "./sessionContext";

export const activityService = {
  async log(input: {
    action: ActivityAction;
    entityType: EntityType;
    entityId: string;
    reference: string;
    description: string;
  }) {
    const user = getServiceUser();
    const entry: ActivityLog = {
      id: createId(),
      userId: user.id,
      userName: user.name,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      reference: input.reference,
      description: input.description,
      date: nowIso(),
    };
    await getDb().activityLogs.add(entry);
    return entry;
  },

  async list(limit = 200) {
    return getDb().activityLogs.orderBy("date").reverse().limit(limit).toArray();
  },

  async listForEntity(entityType: EntityType, entityId: string) {
    return (await getDb().activityLogs.toArray())
      .filter((row) => row.entityType === entityType && row.entityId === entityId)
      .sort((a, b) => b.date.localeCompare(a.date));
  },
};
