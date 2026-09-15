import { getDb } from "@/db/db";
import { partSchema, type PartFormValues } from "@/schemas";
import { createId, nowIso } from "@/lib/utils";
import type { AlternatePartNumber, Part, PartLookup } from "@/types";
import { activityService } from "./activityService";
import { inventoryService } from "./inventoryService";

function normalizePn(value: string) {
  return value.trim().toUpperCase();
}

export const partService = {
  async list() {
    return getDb().parts.orderBy("partNumber").toArray();
  },

  async get(id: string) {
    return getDb().parts.get(id);
  },

  async getAlternates(partId: string) {
    return getDb().alternatePartNumbers.where("partId").equals(partId).toArray();
  },

  async getByPartNumber(partNumber: string) {
    const needle = normalizePn(partNumber);
    const parts = await getDb().parts.toArray();
    return parts.find((part) => normalizePn(part.partNumber) === needle) ?? null;
  },

  async findByAnyNumber(query: string) {
    const needle = normalizePn(query);
    if (!needle) return null;
    const parts = await this.list();
    const alternates = await getDb().alternatePartNumbers.toArray();
    const direct = parts.find((part) => normalizePn(part.partNumber) === needle);
    if (direct) return direct;
    const alt = alternates.find((item) => normalizePn(item.alternateNumber) === needle);
    if (!alt) return null;
    return parts.find((part) => part.id === alt.partId) ?? null;
  },

  async search(query: string) {
    const needle = query.trim().toLowerCase();
    const parts = await this.list();
    const alternates = await getDb().alternatePartNumbers.toArray();
    if (!needle) return parts;
    return parts.filter((part) => {
      const alts = alternates
        .filter((item) => item.partId === part.id)
        .map((item) => item.alternateNumber.toLowerCase())
        .join(" ");
      return (
        part.partNumber.toLowerCase().includes(needle) ||
        part.description.toLowerCase().includes(needle) ||
        part.category.toLowerCase().includes(needle) ||
        alts.includes(needle)
      );
    });
  },

  async lookup(query: string): Promise<PartLookup | null> {
    const part = await this.findByAnyNumber(query);
    if (!part) return null;
    const alternates = await this.getAlternates(part.id);
    const currentStock = await inventoryService.getQuantity(part.id);
    const items = await getDb().grnItems.where("partId").equals(part.id).toArray();
    const latestItem = items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    let lastSupplierName: string | null = null;
    if (latestItem) {
      const grn = await getDb().grns.get(latestItem.grnId);
      if (grn) {
        const supplier = await getDb().suppliers.get(grn.supplierId);
        lastSupplierName = supplier?.name ?? null;
      }
    }
    return {
      part,
      alternates: alternates.map((item) => item.alternateNumber),
      currentStock,
      lastSupplierName,
      lastCost: latestItem?.purchaseCostEa ?? part.defaultCost,
    };
  },

  async create(values: PartFormValues) {
    const parsed = partSchema.parse(values);
    const existing = await this.findByAnyNumber(parsed.partNumber);
    if (existing) {
      throw new Error(`Part ${parsed.partNumber} already exists as ${existing.partNumber}`);
    }
    const timestamp = nowIso();
    const part: Part = {
      id: createId(),
      partNumber: parsed.partNumber.trim().toUpperCase(),
      description: parsed.description.trim(),
      category: parsed.category,
      unitOfMeasure: parsed.unitOfMeasure,
      defaultCost: parsed.defaultCost,
      defaultSalePrice: parsed.defaultSalePrice,
      status: parsed.status,
      notes: parsed.notes,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const alts = uniqueAlts(parsed.alternateNumbers);
    await getDb().transaction("rw", [getDb().parts, getDb().alternatePartNumbers, getDb().activityLogs], async () => {
      await getDb().parts.add(part);
      await replaceAlternates(part.id, alts, timestamp);
    });
    await activityService.log({
      action: "created",
      entityType: "part",
      entityId: part.id,
      reference: part.partNumber,
      description: `Created part ${part.partNumber}`,
    });
    return part;
  },

  async update(id: string, values: PartFormValues) {
    const parsed = partSchema.parse(values);
    const current = await this.get(id);
    if (!current) throw new Error("Part not found");
    const clash = await this.findByAnyNumber(parsed.partNumber);
    if (clash && clash.id !== id) {
      throw new Error(`Part number ${parsed.partNumber} is already used`);
    }
    const timestamp = nowIso();
    const next: Part = {
      ...current,
      partNumber: parsed.partNumber.trim().toUpperCase(),
      description: parsed.description.trim(),
      category: parsed.category,
      unitOfMeasure: parsed.unitOfMeasure,
      defaultCost: parsed.defaultCost,
      defaultSalePrice: parsed.defaultSalePrice,
      status: parsed.status,
      notes: parsed.notes,
      updatedAt: timestamp,
    };
    await getDb().transaction("rw", [getDb().parts, getDb().alternatePartNumbers], async () => {
      await getDb().parts.put(next);
      await replaceAlternates(id, uniqueAlts(parsed.alternateNumbers), timestamp);
    });
    await activityService.log({
      action: "updated",
      entityType: "part",
      entityId: id,
      reference: next.partNumber,
      description: `Updated part ${next.partNumber}`,
    });
    return next;
  },

  async setStatus(id: string, status: Part["status"]) {
    const part = await this.get(id);
    if (!part) throw new Error("Part not found");
    await getDb().parts.update(id, { status, updatedAt: nowIso() });
    await activityService.log({
      action: status === "inactive" ? "archived" : "restored",
      entityType: "part",
      entityId: id,
      reference: part.partNumber,
      description: `${status === "inactive" ? "Deactivated" : "Reactivated"} part ${part.partNumber}`,
    });
  },
};

function uniqueAlts(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const next = value.trim().toUpperCase();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    result.push(next);
  }
  return result;
}

async function replaceAlternates(partId: string, numbers: string[], timestamp: string) {
  await getDb().alternatePartNumbers.where("partId").equals(partId).delete();
  const rows: AlternatePartNumber[] = numbers.map((alternateNumber) => ({
    id: createId(),
    partId,
    alternateNumber,
    notes: "",
    createdAt: timestamp,
  }));
  if (rows.length) await getDb().alternatePartNumbers.bulkAdd(rows);
}
