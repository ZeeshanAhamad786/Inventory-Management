import { getDb } from "@/db/db";
import { supplierSchema, type SupplierFormValues } from "@/schemas";
import { createId, nowIso } from "@/lib/utils";
import type { Supplier } from "@/types";
import { activityService } from "./activityService";

export const supplierService = {
  async list() {
    return getDb().suppliers.orderBy("name").toArray();
  },

  async get(id: string) {
    return getDb().suppliers.get(id);
  },

  async create(values: SupplierFormValues) {
    const parsed = supplierSchema.parse(values);
    const timestamp = nowIso();
    const supplier: Supplier = {
      id: createId(),
      name: parsed.name.trim(),
      contactPerson: parsed.contactPerson.trim(),
      email: parsed.email.trim(),
      phone: parsed.phone.trim(),
      address: parsed.address.trim(),
      notes: parsed.notes,
      status: parsed.status,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await getDb().suppliers.add(supplier);
    await activityService.log({
      action: "created",
      entityType: "supplier",
      entityId: supplier.id,
      reference: supplier.name,
      description: `Created supplier ${supplier.name}`,
    });
    return supplier;
  },

  async update(id: string, values: SupplierFormValues) {
    const parsed = supplierSchema.parse(values);
    const current = await this.get(id);
    if (!current) throw new Error("Supplier not found");
    const next: Supplier = {
      ...current,
      ...parsed,
      name: parsed.name.trim(),
      updatedAt: nowIso(),
    };
    await getDb().suppliers.put(next);
    await activityService.log({
      action: "updated",
      entityType: "supplier",
      entityId: id,
      reference: next.name,
      description: `Updated supplier ${next.name}`,
    });
    return next;
  },

  async setStatus(id: string, status: Supplier["status"]) {
    const supplier = await this.get(id);
    if (!supplier) throw new Error("Supplier not found");
    await getDb().suppliers.update(id, { status, updatedAt: nowIso() });
  },

  async getDetail(id: string) {
    const supplier = await this.get(id);
    if (!supplier) return null;
    const grns = (await getDb().grns.where("supplierId").equals(id).toArray()).filter(
      (grn) => grn.status !== "cancelled",
    );
    const grnIds = new Set(grns.map((grn) => grn.id));
    const items = (await getDb().grnItems.toArray()).filter((item) => grnIds.has(item.grnId));
    const partIds = [...new Set(items.map((item) => item.partId))];
    const parts = await getDb().parts.bulkGet(partIds);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPurchaseValue = items.reduce((sum, item) => sum + item.quantity * item.purchaseCostEa, 0);
    return {
      supplier,
      grns: grns.sort((a, b) => b.date.localeCompare(a.date)),
      items,
      parts: parts.filter(Boolean),
      totalQuantity,
      totalPurchaseValue,
    };
  },
};
