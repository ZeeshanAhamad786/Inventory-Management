import { getDb } from "@/db/db";
import { grnSchema, type GrnFormValues } from "@/schemas";
import { createId, nowIso } from "@/lib/utils";
import type { Grn, GrnItem, GrnStatus } from "@/types";
import { activityService } from "./activityService";
import { inventoryService } from "./inventoryService";
import { getServiceUser } from "./sessionContext";

export const grnService = {
  async list() {
    return getDb().grns.orderBy("date").reverse().toArray();
  },

  async get(id: string) {
    return getDb().grns.get(id);
  },

  async getItems(grnId: string) {
    return (await getDb().grnItems.where("grnId").equals(grnId).toArray()).sort(
      (a, b) => a.lineNumber - b.lineNumber,
    );
  },

  async getDetail(id: string) {
    const grn = await this.get(id);
    if (!grn) return null;
    const items = await this.getItems(id);
    const [supplier, workpack, documents, costings] = await Promise.all([
      getDb().suppliers.get(grn.supplierId),
      grn.workpackId ? getDb().workpacks.get(grn.workpackId) : Promise.resolve(undefined),
      getDb().documents.toArray().then((rows) => rows.filter((doc) => doc.entityType === "grn" && doc.entityId === id)),
      getDb().costings.where("grnId").equals(id).toArray(),
    ]);
    const parts = await getDb().parts.bulkGet(items.map((item) => item.partId));
    const locations = await getDb().locations.toArray();
    const workpacks = await getDb().workpacks.toArray();
    return {
      grn,
      items,
      supplier: supplier ?? null,
      workpack: workpack ?? null,
      documents,
      costings,
      parts: parts.filter((part): part is NonNullable<typeof part> => Boolean(part)),
      locations,
      workpacks,
    };
  },

  async nextNumber() {
    const settings = await getDb().settings.get("app");
    const prefix = settings?.grnPrefix ?? "GR";
    const sequence = settings?.nextGrnSequence ?? 1;
    return `${prefix}${sequence}`;
  },

  async create(values: GrnFormValues, status: GrnStatus = "received") {
    const parsed = grnSchema.parse(values);
    await assertUniqueGrnNumber(parsed.grnNumber);
    const user = getServiceUser();
    const timestamp = nowIso();
    const grn: Grn = {
      id: createId(),
      grnNumber: parsed.grnNumber.trim(),
      date: parsed.date,
      supplierId: parsed.supplierId,
      invoice: parsed.invoice.trim(),
      supplierTrackingReference: parsed.supplierTrackingReference.trim(),
      supplierBatchNumber: parsed.supplierBatchNumber.trim(),
      workpackId: parsed.workpackId,
      registration: parsed.registration.trim().toUpperCase(),
      sheetNumber: parsed.sheetNumber,
      totalSheets: parsed.totalSheets,
      notes: parsed.notes,
      status,
      createdBy: user.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const items: GrnItem[] = parsed.items.map((item, index) => ({
      id: createId(),
      grnId: grn.id,
      lineNumber: index + 1,
      partId: item.partId,
      alternatePartNumber: item.alternatePartNumber.trim(),
      serialNumber: item.serialNumber.trim(),
      description: item.description.trim(),
      quantity: item.quantity,
      supplierBatchNumber: item.supplierBatchNumber.trim() || parsed.supplierBatchNumber.trim(),
      purchaseCostEa: item.purchaseCostEa,
      locationId: item.locationId,
      workpackId: item.workpackId ?? parsed.workpackId,
      notes: item.notes,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    await getDb().transaction("rw", [getDb().grns, getDb().grnItems, getDb().settings], async () => {
      await getDb().grns.add(grn);
      await getDb().grnItems.bulkAdd(items);
      const settings = await getDb().settings.get("app");
      if (settings?.autoGrnNumber) {
        await getDb().settings.update("app", {
          nextGrnSequence: settings.nextGrnSequence + 1,
          updatedAt: timestamp,
        });
      }
    });

    if (status === "received") {
      for (const item of items) {
        if (item.quantity > 0) {
          await inventoryService.recordMovement({
            partId: item.partId,
            quantityChange: item.quantity,
            type: "RECEIPT",
            referenceType: "grn",
            referenceId: grn.id,
            grnId: grn.id,
            grnItemId: item.id,
            workpackId: item.workpackId,
            locationId: item.locationId,
            date: grn.date,
            notes: `Received on ${grn.grnNumber}`,
          });
        }
      }
      await activityService.log({
        action: "stock_received",
        entityType: "grn",
        entityId: grn.id,
        reference: grn.grnNumber,
        description: `Stock received for ${grn.grnNumber} (${items.length} lines)`,
      });
    }

    await activityService.log({
      action: "created",
      entityType: "grn",
      entityId: grn.id,
      reference: grn.grnNumber,
      description: `Created GRN ${grn.grnNumber}`,
    });
    return grn;
  },

  async update(id: string, values: GrnFormValues) {
    const parsed = grnSchema.parse(values);
    const current = await this.get(id);
    if (!current) throw new Error("GRN not found");
    if (current.status === "cancelled" || current.status === "archived") {
      throw new Error("Cancelled or archived GRNs cannot be edited");
    }
    await assertUniqueGrnNumber(parsed.grnNumber, id);
    const timestamp = nowIso();
    const next: Grn = {
      ...current,
      grnNumber: parsed.grnNumber.trim(),
      date: parsed.date,
      supplierId: parsed.supplierId,
      invoice: parsed.invoice.trim(),
      supplierTrackingReference: parsed.supplierTrackingReference.trim(),
      supplierBatchNumber: parsed.supplierBatchNumber.trim(),
      workpackId: parsed.workpackId,
      registration: parsed.registration.trim().toUpperCase(),
      sheetNumber: parsed.sheetNumber,
      totalSheets: parsed.totalSheets,
      notes: parsed.notes,
      updatedAt: timestamp,
    };
    const existingItems = await this.getItems(id);
    await getDb().transaction("rw", [getDb().grns, getDb().grnItems, getDb().stockMovements], async () => {
      await getDb().grns.put(next);
      await getDb().grnItems.where("grnId").equals(id).delete();
      const items: GrnItem[] = parsed.items.map((item, index) => ({
        id: existingItems[index]?.id ?? createId(),
        grnId: id,
        lineNumber: index + 1,
        partId: item.partId,
        alternatePartNumber: item.alternatePartNumber.trim(),
        serialNumber: item.serialNumber.trim(),
        description: item.description.trim(),
        quantity: item.quantity,
        supplierBatchNumber: item.supplierBatchNumber.trim() || parsed.supplierBatchNumber.trim(),
        purchaseCostEa: item.purchaseCostEa,
        locationId: item.locationId,
        workpackId: item.workpackId ?? parsed.workpackId,
        notes: item.notes,
        createdAt: existingItems[index]?.createdAt ?? timestamp,
        updatedAt: timestamp,
      }));
      await getDb().grnItems.bulkAdd(items);
      if (current.status === "received") {
        await getDb()
          .stockMovements.where("grnId")
          .equals(id)
          .filter((movement) => movement.type === "RECEIPT")
          .delete();
      }
    });

    if (current.status === "received") {
      const items = await this.getItems(id);
      for (const item of items) {
        if (item.quantity > 0) {
          await inventoryService.recordMovement({
            partId: item.partId,
            quantityChange: item.quantity,
            type: "RECEIPT",
            referenceType: "grn",
            referenceId: id,
            grnId: id,
            grnItemId: item.id,
            workpackId: item.workpackId,
            locationId: item.locationId,
            date: next.date,
            notes: `Received on ${next.grnNumber}`,
          });
        }
      }
    }

    await activityService.log({
      action: "updated",
      entityType: "grn",
      entityId: id,
      reference: next.grnNumber,
      description: `Updated GRN ${next.grnNumber}`,
    });
    return next;
  },

  async setStatus(id: string, status: GrnStatus) {
    const grn = await this.get(id);
    if (!grn) throw new Error("GRN not found");
    if (grn.status === status) return grn;
    if (status === "cancelled" && grn.status === "received") {
      const receipts = (await getDb().stockMovements.where("grnId").equals(id).toArray()).filter(
        (movement) => movement.type === "RECEIPT",
      );
      for (const receipt of receipts) {
        await inventoryService.recordMovement({
          partId: receipt.partId,
          quantityChange: -receipt.quantityChange,
          type: "ADJUSTMENT_OUT",
          referenceType: "grn",
          referenceId: id,
          grnId: id,
          grnItemId: receipt.grnItemId,
          workpackId: receipt.workpackId,
          locationId: receipt.locationId,
          notes: `Reversal because ${grn.grnNumber} was cancelled`,
        });
      }
    }
    await getDb().grns.update(id, { status, updatedAt: nowIso() });
    await activityService.log({
      action: status === "cancelled" ? "cancelled" : status === "archived" ? "archived" : "updated",
      entityType: "grn",
      entityId: id,
      reference: grn.grnNumber,
      description: `GRN ${grn.grnNumber} marked ${status}`,
    });
    return { ...grn, status };
  },
};

async function assertUniqueGrnNumber(grnNumber: string, ignoreId?: string) {
  const existing = await getDb().grns.where("grnNumber").equals(grnNumber.trim()).toArray();
  const clash = existing.find(
    (grn) => grn.id !== ignoreId && grn.status !== "cancelled" && grn.status !== "archived",
  );
  if (clash) {
    throw new Error(`GRN number ${grnNumber} already exists`);
  }
}
