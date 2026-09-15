import { getDb } from "@/db/db";
import { csvEscape, formatGbp, formatUkDate } from "@/lib/format";
import { sumCostings } from "@/lib/pricing";
import { inventoryService } from "./inventoryService";
import { activityService } from "./activityService";

export type ReportType =
  | "inventory"
  | "grns"
  | "costing"
  | "profit"
  | "suppliers"
  | "workpacks"
  | "movements"
  | "locations";

export interface ReportFilters {
  from?: string;
  to?: string;
  search?: string;
  supplierId?: string;
  partId?: string;
  workpackId?: string;
  locationId?: string;
  grnId?: string;
}

function inRange(date: string, filters: ReportFilters) {
  if (filters.from && date < filters.from) return false;
  if (filters.to && date > `${filters.to}T23:59:59`) return false;
  return true;
}

function matchesSearch(haystack: string, search?: string) {
  if (!search?.trim()) return true;
  return haystack.toLowerCase().includes(search.trim().toLowerCase());
}

export const reportService = {
  async inventory(filters: ReportFilters = {}) {
    const rows = await inventoryService.listRows();
    return rows.filter((row) => {
      if (filters.partId && row.partId !== filters.partId) return false;
      if (filters.locationId && !row.locationNames) return false;
      return matchesSearch(
        `${row.partNumber} ${row.alternateNumbers} ${row.description} ${row.locationNames}`,
        filters.search,
      );
    });
  },

  async grns(filters: ReportFilters = {}) {
    const [grns, items, suppliers, workpacks] = await Promise.all([
      getDb().grns.toArray(),
      getDb().grnItems.toArray(),
      getDb().suppliers.toArray(),
      getDb().workpacks.toArray(),
    ]);
    const supplierMap = new Map(suppliers.map((row) => [row.id, row.name]));
    const workpackMap = new Map(workpacks.map((row) => [row.id, row.workpackNumber]));
    return grns
      .filter((grn) => inRange(grn.date, filters))
      .filter((grn) => !filters.supplierId || grn.supplierId === filters.supplierId)
      .filter((grn) => !filters.workpackId || grn.workpackId === filters.workpackId)
      .filter((grn) => matchesSearch(`${grn.grnNumber} ${grn.invoice} ${grn.supplierTrackingReference}`, filters.search))
      .map((grn) => {
        const grnItems = items.filter((item) => item.grnId === grn.id);
        const quantity = grnItems.reduce((sum, item) => sum + item.quantity, 0);
        const purchaseValue = grnItems.reduce((sum, item) => sum + item.quantity * item.purchaseCostEa, 0);
        return {
          id: grn.id,
          grnNumber: grn.grnNumber,
          date: grn.date,
          supplier: supplierMap.get(grn.supplierId) ?? "—",
          items: grnItems.length,
          quantity,
          purchaseValue,
          workpack: workpackMap.get(grn.workpackId ?? "") ?? "—",
          status: grn.status,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  async costing(filters: ReportFilters = {}) {
    const [costings, grns, parts, items] = await Promise.all([
      getDb().costings.toArray(),
      getDb().grns.toArray(),
      getDb().parts.toArray(),
      getDb().grnItems.toArray(),
    ]);
    const grnMap = new Map(grns.map((row) => [row.id, row]));
    const partMap = new Map(parts.map((row) => [row.id, row]));
    const itemMap = new Map(items.map((row) => [row.id, row]));
    return costings
      .filter((row) => {
        const grn = grnMap.get(row.grnId);
        if (!grn) return false;
        if (!inRange(grn.date, filters)) return false;
        if (filters.supplierId && grn.supplierId !== filters.supplierId) return false;
        if (filters.partId && row.partId !== filters.partId) return false;
        if (filters.grnId && row.grnId !== filters.grnId) return false;
        if (filters.workpackId) {
          const item = itemMap.get(row.grnItemId);
          if (item?.workpackId !== filters.workpackId && grn.workpackId !== filters.workpackId) return false;
        }
        const part = partMap.get(row.partId);
        return matchesSearch(`${grn.grnNumber} ${part?.partNumber ?? ""} ${part?.description ?? ""}`, filters.search);
      })
      .map((row) => {
        const grn = grnMap.get(row.grnId)!;
        const part = partMap.get(row.partId);
        return {
          ...row,
          grnNumber: grn.grnNumber,
          date: grn.date,
          partNumber: part?.partNumber ?? "—",
          description: part?.description ?? "—",
        };
      });
  },

  async profit(filters: ReportFilters = {}) {
    const rows = await this.costing(filters);
    return {
      rows,
      totals: sumCostings(rows),
    };
  },

  async suppliers(filters: ReportFilters = {}) {
    const [suppliers, grns, items] = await Promise.all([
      getDb().suppliers.toArray(),
      getDb().grns.toArray(),
      getDb().grnItems.toArray(),
    ]);
    return suppliers
      .filter((supplier) => matchesSearch(`${supplier.name} ${supplier.contactPerson}`, filters.search))
      .map((supplier) => {
        const supplierGrns = grns.filter(
          (grn) => grn.supplierId === supplier.id && grn.status !== "cancelled" && inRange(grn.date, filters),
        );
        const grnIds = new Set(supplierGrns.map((grn) => grn.id));
        const supplierItems = items.filter((item) => grnIds.has(item.grnId));
        return {
          id: supplier.id,
          name: supplier.name,
          status: supplier.status,
          grnCount: supplierGrns.length,
          quantity: supplierItems.reduce((sum, item) => sum + item.quantity, 0),
          purchaseValue: supplierItems.reduce((sum, item) => sum + item.quantity * item.purchaseCostEa, 0),
        };
      });
  },

  async workpacks(filters: ReportFilters = {}) {
    const [workpacks, items, costings] = await Promise.all([
      getDb().workpacks.toArray(),
      getDb().grnItems.toArray(),
      getDb().costings.toArray(),
    ]);
    return workpacks
      .filter((workpack) => matchesSearch(`${workpack.workpackNumber} ${workpack.title} ${workpack.registration}`, filters.search))
      .map((workpack) => {
        const wpItems = items.filter((item) => item.workpackId === workpack.id);
        const wpCostings = costings.filter((row) => wpItems.some((item) => item.id === row.grnItemId));
        const totals = sumCostings(wpCostings);
        return {
          id: workpack.id,
          workpackNumber: workpack.workpackNumber,
          title: workpack.title,
          registration: workpack.registration,
          status: workpack.status,
          itemCount: wpItems.length,
          quantity: wpItems.reduce((sum, item) => sum + item.quantity, 0),
          totalCost: totals.totalCost,
          totalSale: totals.totalSale,
          profit: totals.profit,
        };
      });
  },

  async movements(filters: ReportFilters = {}) {
    const [movements, parts, workpacks, grns] = await Promise.all([
      getDb().stockMovements.toArray(),
      getDb().parts.toArray(),
      getDb().workpacks.toArray(),
      getDb().grns.toArray(),
    ]);
    const partMap = new Map(parts.map((row) => [row.id, row]));
    const wpMap = new Map(workpacks.map((row) => [row.id, row.workpackNumber]));
    const grnMap = new Map(grns.map((row) => [row.id, row.grnNumber]));
    return movements
      .filter((movement) => inRange(movement.date, filters))
      .filter((movement) => !filters.partId || movement.partId === filters.partId)
      .filter((movement) => !filters.workpackId || movement.workpackId === filters.workpackId)
      .filter((movement) => !filters.locationId || movement.locationId === filters.locationId)
      .map((movement) => ({
        ...movement,
        partNumber: partMap.get(movement.partId)?.partNumber ?? "—",
        description: partMap.get(movement.partId)?.description ?? "—",
        workpackNumber: wpMap.get(movement.workpackId ?? "") ?? "—",
        grnNumber: grnMap.get(movement.grnId ?? "") ?? "—",
      }))
      .filter((row) => matchesSearch(`${row.partNumber} ${row.description} ${row.grnNumber} ${row.workpackNumber}`, filters.search))
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  async locations(filters: ReportFilters = {}) {
    const [locations, rows] = await Promise.all([getDb().locations.toArray(), inventoryService.listRows()]);
    return locations
      .filter((location) => matchesSearch(`${location.name} ${location.code}`, filters.search))
      .map((location) => {
        const matching = rows.filter((row) => row.locationNames.includes(location.name));
        return {
          ...location,
          partCount: matching.length,
          quantity: matching.reduce((sum, row) => sum + row.currentQty, 0),
          stockValue: matching.reduce((sum, row) => sum + (row.stockCostValue ?? 0), 0),
        };
      });
  },

  async exportCsv(type: ReportType, filters: ReportFilters = {}) {
    const { headers, rows } = await this.toTable(type, filters);
    const csv = [headers.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${type}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
    await activityService.log({
      action: "report_generated",
      entityType: "report",
      entityId: type,
      reference: type,
      description: `Exported ${type} report to CSV`,
    });
  },

  async toTable(type: ReportType, filters: ReportFilters = {}) {
    switch (type) {
      case "inventory": {
        const data = await this.inventory(filters);
        return {
          headers: ["P/N", "Alternate P/N", "Description", "Qty", "Cost", "Stock Value", "Sale Price", "Potential Sale", "Potential Profit", "Location"],
          rows: data.map((row) => [
            row.partNumber,
            row.alternateNumbers,
            row.description,
            row.currentQty,
            row.costPrice ?? "",
            row.stockCostValue ?? "",
            row.isPoa ? "POA" : (row.salePrice ?? ""),
            row.potentialSaleValue ?? "",
            row.potentialProfit ?? "",
            row.locationNames,
          ]),
        };
      }
      case "grns": {
        const data = await this.grns(filters);
        return {
          headers: ["GRN", "Date", "Supplier", "Items", "Quantity", "Purchase Value", "Workpack", "Status"],
          rows: data.map((row) => [
            row.grnNumber,
            formatUkDate(row.date),
            row.supplier,
            row.items,
            row.quantity,
            formatGbp(row.purchaseValue),
            row.workpack,
            row.status,
          ]),
        };
      }
      case "costing":
      case "profit": {
        const data = type === "profit" ? (await this.profit(filters)).rows : await this.costing(filters);
        return {
          headers: ["GRN", "Date", "P/N", "Description", "Qty", "Cost EA", "Total Cost", "Sale EA", "Total Sale", "Profit", "Profit %", "Method"],
          rows: data.map((row) => [
            row.grnNumber,
            formatUkDate(row.date),
            row.partNumber,
            row.description,
            row.quantity,
            row.purchaseCostEa,
            row.totalCost,
            row.salePriceEa ?? "POA",
            row.totalSale ?? "POA",
            row.profit ?? "POA",
            row.profitPercent ?? "POA",
            row.pricingMethod,
          ]),
        };
      }
      case "suppliers": {
        const data = await this.suppliers(filters);
        return {
          headers: ["Supplier", "Status", "GRNs", "Quantity", "Purchase Value"],
          rows: data.map((row) => [row.name, row.status, row.grnCount, row.quantity, row.purchaseValue]),
        };
      }
      case "workpacks": {
        const data = await this.workpacks(filters);
        return {
          headers: ["Workpack", "Title", "Reg", "Status", "Items", "Qty", "Cost", "Sale", "Profit"],
          rows: data.map((row) => [
            row.workpackNumber,
            row.title,
            row.registration,
            row.status,
            row.itemCount,
            row.quantity,
            row.totalCost,
            row.totalSale ?? "POA",
            row.profit ?? "POA",
          ]),
        };
      }
      case "movements": {
        const data = await this.movements(filters);
        return {
          headers: ["Date", "P/N", "Description", "Type", "Qty", "GRN", "Workpack", "Notes"],
          rows: data.map((row) => [
            formatUkDate(row.date),
            row.partNumber,
            row.description,
            row.type,
            row.quantityChange,
            row.grnNumber,
            row.workpackNumber,
            row.notes,
          ]),
        };
      }
      case "locations": {
        const data = await this.locations(filters);
        return {
          headers: ["Store", "Code", "Description", "Parts", "Qty", "Stock Value"],
          rows: data.map((row) => [row.name, row.code, row.description, row.partCount, row.quantity, row.stockValue]),
        };
      }
    }
  },
};
