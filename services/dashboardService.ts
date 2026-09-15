import { getDb } from "@/db/db";
import type { DashboardStats, Grn, StockMovement, Workpack } from "@/types";
import { inventoryService } from "./inventoryService";

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const [grns, parts, suppliers, workpacks, inventory] = await Promise.all([
      getDb().grns.toArray(),
      getDb().parts.toArray(),
      getDb().suppliers.toArray(),
      getDb().workpacks.toArray(),
      inventoryService.listRows(),
    ]);
    const activeGrns = grns.filter((grn) => grn.status !== "cancelled");
    const totalStockQty = inventory.reduce((sum, row) => sum + row.currentQty, 0);
    const totalStockCostValue = inventory.reduce((sum, row) => sum + (row.stockCostValue ?? 0), 0);
    const potentialSalesValue = inventory.reduce((sum, row) => sum + (row.potentialSaleValue ?? 0), 0);
    const potentialProfit = inventory.reduce((sum, row) => sum + (row.potentialProfit ?? 0), 0);
    return {
      totalGrns: activeGrns.length,
      totalParts: parts.filter((part) => part.status === "active").length,
      totalStockQty,
      totalStockCostValue,
      potentialSalesValue,
      potentialProfit,
      supplierCount: suppliers.filter((supplier) => supplier.status === "active").length,
      activeWorkpacks: workpacks.filter(
        (workpack) => workpack.status === "open" || workpack.status === "in_progress",
      ).length,
      poaItems: inventory.filter((row) => row.isPoa).length,
    };
  },

  async recentGrns(limit = 6): Promise<Grn[]> {
    return getDb().grns.orderBy("date").reverse().limit(limit).toArray();
  },

  async recentMovements(limit = 8): Promise<StockMovement[]> {
    return getDb().stockMovements.orderBy("date").reverse().limit(limit).toArray();
  },

  async recentWorkpacks(limit = 5): Promise<Workpack[]> {
    return getDb().workpacks.orderBy("updatedAt").reverse().limit(limit).toArray();
  },

  async lowStock() {
    const rows = await inventoryService.listRows();
    return rows.filter((row) => row.currentQty <= 0 || (row.currentQty > 0 && row.currentQty < 5));
  },

  async recentCostings(limit = 6) {
    return getDb().costings.orderBy("updatedAt").reverse().limit(limit).toArray();
  },

  async grnsByMonth() {
    const grns = await getDb().grns.toArray();
    const map = new Map<string, number>();
    for (const grn of grns) {
      if (grn.status === "cancelled") continue;
      const key = grn.date.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));
  },
};
