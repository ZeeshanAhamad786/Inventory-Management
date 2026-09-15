import { getDb } from "@/db/db";
import { workpackSchema, type WorkpackFormValues } from "@/schemas";
import { createId, nowIso } from "@/lib/utils";
import type { Workpack } from "@/types";
import { activityService } from "./activityService";
import { sumCostings } from "@/lib/pricing";

export const workpackService = {
  async list() {
    return getDb().workpacks.orderBy("workpackNumber").toArray();
  },

  async get(id: string) {
    return getDb().workpacks.get(id);
  },

  async create(values: WorkpackFormValues) {
    const parsed = workpackSchema.parse(values);
    const timestamp = nowIso();
    const workpack: Workpack = {
      id: createId(),
      workpackNumber: parsed.workpackNumber.trim(),
      title: parsed.title.trim(),
      registration: parsed.registration.trim().toUpperCase(),
      status: parsed.status,
      startDate: parsed.startDate,
      completionDate: parsed.completionDate,
      notes: parsed.notes,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await getDb().workpacks.add(workpack);
    await activityService.log({
      action: "created",
      entityType: "workpack",
      entityId: workpack.id,
      reference: workpack.workpackNumber,
      description: `Created workpack ${workpack.workpackNumber}`,
    });
    return workpack;
  },

  async update(id: string, values: WorkpackFormValues) {
    const parsed = workpackSchema.parse(values);
    const current = await this.get(id);
    if (!current) throw new Error("Workpack not found");
    const next: Workpack = {
      ...current,
      ...parsed,
      workpackNumber: parsed.workpackNumber.trim(),
      title: parsed.title.trim(),
      registration: parsed.registration.trim().toUpperCase(),
      updatedAt: nowIso(),
    };
    await getDb().workpacks.put(next);
    await activityService.log({
      action: "updated",
      entityType: "workpack",
      entityId: id,
      reference: next.workpackNumber,
      description: `Updated workpack ${next.workpackNumber}`,
    });
    return next;
  },

  async getDetail(id: string) {
    const workpack = await this.get(id);
    if (!workpack) return null;
    const items = await getDb().grnItems.where("workpackId").equals(id).toArray();
    const headerGrns = await getDb().grns.where("workpackId").equals(id).toArray();
    const grnIds = new Set([...items.map((item) => item.grnId), ...headerGrns.map((grn) => grn.id)]);
    const grns = (await getDb().grns.bulkGet([...grnIds])).filter(Boolean);
    const movements = await getDb().stockMovements.where("workpackId").equals(id).toArray();
    const costings = (await getDb().costings.toArray()).filter((row) =>
      items.some((item) => item.id === row.grnItemId),
    );
    const parts = await getDb().parts.bulkGet([...new Set(items.map((item) => item.partId))]);
    const totals = sumCostings(costings);
    const receivedQty = items.reduce((sum, item) => sum + item.quantity, 0);
    const issuedQty = movements
      .filter((movement) => movement.type === "ISSUE")
      .reduce((sum, movement) => sum + Math.abs(movement.quantityChange), 0);
    return {
      workpack,
      items,
      grns,
      movements: movements.sort((a, b) => b.date.localeCompare(a.date)),
      costings,
      parts: parts.filter(Boolean),
      totals,
      receivedQty,
      issuedQty,
    };
  },
};
