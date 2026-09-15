import { getDb } from "@/db/db";
import { stockIssueSchema, type StockIssueFormValues } from "@/schemas";
import { createId, nowIso, roundMoney } from "@/lib/utils";
import type { InventoryRow, StockMovement, StockMovementType } from "@/types";
import { activityService } from "./activityService";
import { getServiceUser } from "./sessionContext";

export const inventoryService = {
  async listMovements() {
    return getDb().stockMovements.orderBy("date").reverse().toArray();
  },

  async movementsForPart(partId: string) {
    return getDb()
      .stockMovements.where("partId")
      .equals(partId)
      .reverse()
      .sortBy("date");
  },

  async getQuantity(partId: string) {
    const movements = await getDb().stockMovements.where("partId").equals(partId).toArray();
    return roundMoney(movements.reduce((sum, movement) => sum + movement.quantityChange, 0));
  },

  async getQuantityByLocation(partId: string) {
    const movements = await getDb().stockMovements.where("partId").equals(partId).toArray();
    const map = new Map<string, number>();
    for (const movement of movements) {
      const key = movement.locationId ?? "unassigned";
      map.set(key, (map.get(key) ?? 0) + movement.quantityChange);
    }
    return map;
  },

  async averageCost(partId: string) {
    const items = await getDb().grnItems.where("partId").equals(partId).toArray();
    const grns = await getDb().grns.toArray();
    const activeGrnIds = new Set(
      grns.filter((grn) => grn.status === "received" || grn.status === "draft").map((grn) => grn.id),
    );
    const receipts = items.filter((item) => activeGrnIds.has(item.grnId));
    const qty = receipts.reduce((sum, item) => sum + item.quantity, 0);
    if (qty <= 0) return null;
    const total = receipts.reduce((sum, item) => sum + item.quantity * item.purchaseCostEa, 0);
    return roundMoney(total / qty);
  },

  async latestSale(partId: string) {
    const costings = await getDb().costings.where("partId").equals(partId).reverse().sortBy("updatedAt");
    const latestNumeric = [...costings].reverse().find((row) => row.salePriceEa !== null);
    const latestAny = costings.at(-1);
    return {
      salePrice: latestNumeric?.salePriceEa ?? null,
      isPoa: latestAny?.pricingMethod === "POA" && latestNumeric === undefined,
    };
  },

  async listRows(): Promise<InventoryRow[]> {
    const [parts, alternates, locations] = await Promise.all([
      getDb().parts.toArray(),
      getDb().alternatePartNumbers.toArray(),
      getDb().locations.toArray(),
    ]);
    const locationMap = new Map(locations.map((location) => [location.id, location.name]));
    const rows: InventoryRow[] = [];
    for (const part of parts) {
      const qty = await this.getQuantity(part.id);
      const byLocation = await this.getQuantityByLocation(part.id);
      const costPrice = (await this.averageCost(part.id)) ?? part.defaultCost;
      const sale = await this.latestSale(part.id);
      const salePrice = sale.salePrice ?? part.defaultSalePrice;
      const isPoa = sale.isPoa && salePrice === null;
      const stockCostValue = costPrice === null ? null : roundMoney(qty * costPrice);
      const potentialSaleValue = isPoa || salePrice === null ? null : roundMoney(qty * salePrice);
      const potentialProfit =
        stockCostValue === null || potentialSaleValue === null
          ? null
          : roundMoney(potentialSaleValue - stockCostValue);
      const locationNames = [...byLocation.entries()]
        .filter(([, value]) => value !== 0)
        .map(([key]) => (key === "unassigned" ? "Unassigned" : locationMap.get(key) ?? key))
        .join(", ");
      rows.push({
        partId: part.id,
        partNumber: part.partNumber,
        alternateNumbers: alternates
          .filter((item) => item.partId === part.id)
          .map((item) => item.alternateNumber)
          .join(" / "),
        description: part.description,
        category: part.category,
        currentQty: qty,
        costPrice,
        stockCostValue,
        salePrice,
        potentialSaleValue,
        potentialProfit,
        locationNames,
        status: part.status,
        isPoa,
      });
    }
    return rows.sort((a, b) => a.partNumber.localeCompare(b.partNumber));
  },

  async recordMovement(input: {
    partId: string;
    quantityChange: number;
    type: StockMovementType;
    referenceType: StockMovement["referenceType"];
    referenceId: string;
    grnId?: string | null;
    grnItemId?: string | null;
    workpackId?: string | null;
    locationId?: string | null;
    date?: string;
    notes: string;
  }) {
    const user = getServiceUser();
    const movement: StockMovement = {
      id: createId(),
      partId: input.partId,
      quantityChange: input.quantityChange,
      type: input.type,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      grnId: input.grnId ?? null,
      grnItemId: input.grnItemId ?? null,
      workpackId: input.workpackId ?? null,
      locationId: input.locationId ?? null,
      date: input.date ?? nowIso(),
      userId: user.id,
      notes: input.notes,
      createdAt: nowIso(),
    };
    await getDb().stockMovements.add(movement);
    return movement;
  },

  async adjust(values: StockIssueFormValues) {
    const parsed = stockIssueSchema.parse(values);
    const qty = parsed.quantity;
    const signed =
      parsed.type === "ISSUE" || parsed.type === "ADJUSTMENT_OUT" ? -qty : parsed.type === "TRANSFER" ? -qty : qty;
    if (signed < 0) {
      const current = await this.getQuantity(parsed.partId);
      if (current + signed < 0) {
        throw new Error(`Insufficient stock. Current quantity is ${current}.`);
      }
    }
    const movement = await this.recordMovement({
      partId: parsed.partId,
      quantityChange: signed,
      type: parsed.type,
      referenceType: parsed.workpackId ? "workpack" : "stock_movement",
      referenceId: parsed.workpackId ?? `adj-${createId()}`,
      workpackId: parsed.workpackId,
      locationId: parsed.locationId,
      notes: parsed.notes,
    });
    await activityService.log({
      action: parsed.type === "ISSUE" ? "stock_issued" : "stock_adjusted",
      entityType: "stock_movement",
      entityId: movement.id,
      reference: parsed.type,
      description: `${parsed.type} ${qty} for part`,
    });
    return movement;
  },
};
