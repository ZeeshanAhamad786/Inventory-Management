import * as XLSX from "xlsx";
import { getDb } from "@/db/db";
import { partService } from "./partService";
import { supplierService } from "./supplierService";
import { grnService } from "./grnService";
import { costingService } from "./costingService";
import { activityService } from "./activityService";
import type { GrnFormValues } from "@/schemas";
import type { PricingMethod } from "@/types";

export interface ImportColumnMap {
  grnNumber?: string;
  date?: string;
  supplier?: string;
  invoice?: string;
  tracking?: string;
  batch?: string;
  partNumber?: string;
  alternate?: string;
  serial?: string;
  description?: string;
  quantity?: string;
  cost?: string;
  stores?: string;
  workpack?: string;
  notes?: string;
  salePrice?: string;
}

export interface ImportPreviewRow {
  index: number;
  data: Record<string, string>;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ParsedWorkbook {
  sheetNames: string[];
  sheets: Record<string, { headers: string[]; rows: Record<string, string>[] }>;
}

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function excelDateToIso(value: string) {
  if (!value) return new Date().toISOString();
  if (/^\d+(\.\d+)?$/.test(value)) {
    const serial = Number(value);
    const utc = Date.UTC(1899, 11, 30) + serial * 86400000;
    return new Date(utc).toISOString();
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  const uk = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (uk) {
    const year = uk[3].length === 2 ? `20${uk[3]}` : uk[3];
    return new Date(`${year}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}T12:00:00`).toISOString();
  }
  return new Date().toISOString();
}

export const importService = {
  parseWorkbook(buffer: ArrayBuffer): ParsedWorkbook {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheets: ParsedWorkbook["sheets"] = {};
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
      const headers = json.length ? Object.keys(json[0]) : [];
      sheets[name] = {
        headers,
        rows: json.map((row) => {
          const next: Record<string, string> = {};
          for (const header of headers) next[header] = cell(row[header]);
          return next;
        }),
      };
    }
    return { sheetNames: workbook.SheetNames, sheets };
  },

  suggestMap(headers: string[]): ImportColumnMap {
    const lower = headers.map((header) => ({ header, key: header.toLowerCase() }));
    const find = (...needles: string[]) =>
      lower.find((item) => needles.some((needle) => item.key.includes(needle)))?.header;
    return {
      grnNumber: find("grn", "gr number", "gr no"),
      date: find("date"),
      supplier: find("supplier"),
      invoice: find("invoice"),
      tracking: find("tracking"),
      batch: find("batch"),
      partNumber: find("p/n", "pn", "part number", "part no"),
      alternate: find("alternate", "alt p"),
      serial: find("serial"),
      description: find("description", "desc"),
      quantity: find("qty", "quantity"),
      cost: find("cost", "purchase"),
      stores: find("stores", "location"),
      workpack: find("workpack", "job"),
      notes: find("notes", "comment"),
      salePrice: find("sale"),
    };
  },

  preview(rows: Record<string, string>[], map: ImportColumnMap): ImportPreviewRow[] {
    return rows.map((data, index) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const partNumber = map.partNumber ? data[map.partNumber] : "";
      const qtyRaw = map.quantity ? data[map.quantity] : "";
      const costRaw = map.cost ? data[map.cost] : "";
      if (!partNumber) errors.push("Part number is required");
      if (qtyRaw && Number(qtyRaw) < 0) errors.push("Quantity cannot be negative");
      if (costRaw && Number.isNaN(Number(costRaw.replace("£", "")))) errors.push("Cost cannot be invalid");
      if (!map.grnNumber || !data[map.grnNumber]) warnings.push("No GRN number – a group key will be generated");
      if (!map.supplier || !data[map.supplier]) warnings.push("Supplier will default to Unknown Supplier");
      return {
        index: index + 1,
        data,
        valid: errors.length === 0,
        errors,
        warnings,
      };
    });
  },

  async importRows(rows: Record<string, string>[], map: ImportColumnMap) {
    const preview = this.preview(rows, map);
    const valid = preview.filter((row) => row.valid);
    if (!valid.length) throw new Error("No valid rows to import");

    const locations = await getDb().locations.toArray();
    const workpacks = await getDb().workpacks.toArray();
    let unknownSupplier = (await supplierService.list()).find((row) => row.name === "Unknown Supplier");
    if (!unknownSupplier) {
      unknownSupplier = await supplierService.create({
        name: "Unknown Supplier",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        notes: "Created by Excel import",
        status: "active",
      });
    }

    const grouped = new Map<string, typeof valid>();
    for (const row of valid) {
      const grnNumber = (map.grnNumber ? row.data[map.grnNumber] : "") || `IMP-${row.index}`;
      const list = grouped.get(grnNumber) ?? [];
      list.push(row);
      grouped.set(grnNumber, list);
    }

    let importedGrns = 0;
    let importedItems = 0;
    const failures: string[] = [];

    for (const [grnNumber, group] of grouped) {
      try {
        const first = group[0].data;
        const supplierName = (map.supplier ? first[map.supplier] : "") || "Unknown Supplier";
        let supplier = (await supplierService.list()).find(
          (row) => row.name.toLowerCase() === supplierName.toLowerCase(),
        );
        if (!supplier) {
          supplier = await supplierService.create({
            name: supplierName,
            contactPerson: "",
            email: "",
            phone: "",
            address: "",
            notes: "Created by Excel import",
            status: "active",
          });
        }
        const workpackName = map.workpack ? first[map.workpack] : "";
        const workpack = workpacks.find(
          (row) => row.workpackNumber.toLowerCase() === workpackName.toLowerCase(),
        );
        const payload: GrnFormValues = {
          grnNumber,
          date: excelDateToIso(map.date ? first[map.date] : ""),
          supplierId: supplier.id,
          invoice: map.invoice ? first[map.invoice] : "",
          supplierTrackingReference: map.tracking ? first[map.tracking] : "",
          supplierBatchNumber: map.batch ? first[map.batch] : "",
          workpackId: workpack?.id ?? null,
          registration: "",
          sheetNumber: 1,
          totalSheets: 1,
          notes: "Imported from Excel",
          items: [],
        };

        for (const row of group) {
          const pn = map.partNumber ? row.data[map.partNumber] : "";
          let part = await partService.findByAnyNumber(pn);
          if (!part) {
            const alt = map.alternate ? row.data[map.alternate] : "";
            part = await partService.create({
              partNumber: pn,
              description: (map.description ? row.data[map.description] : "") || pn,
              category: "Other",
              unitOfMeasure: "EA",
              defaultCost: map.cost ? Number(row.data[map.cost].replace("£", "")) || null : null,
              defaultSalePrice: null,
              status: "active",
              notes: "Created by Excel import",
              alternateNumbers: alt ? alt.split(/[&,/]/).map((item) => item.trim()).filter(Boolean) : [],
            });
          }
          const stores = map.stores ? row.data[map.stores] : "";
          const location = locations.find(
            (item) =>
              item.name.toLowerCase() === stores.toLowerCase() || item.code.toLowerCase() === stores.toLowerCase(),
          );
          const qty = Number((map.quantity ? row.data[map.quantity] : "0").replace(/,/g, "")) || 0;
          const cost = Number((map.cost ? row.data[map.cost] : "0").replace("£", "").replace(/,/g, "")) || 0;
          payload.items.push({
            partId: part.id,
            alternatePartNumber: map.alternate ? row.data[map.alternate] : "",
            serialNumber: map.serial ? row.data[map.serial] : "",
            description: (map.description ? row.data[map.description] : "") || part.description,
            quantity: qty,
            supplierBatchNumber: map.batch ? row.data[map.batch] : "",
            purchaseCostEa: cost,
            locationId: location?.id ?? null,
            workpackId: workpack?.id ?? null,
            notes: map.notes ? row.data[map.notes] : "",
          });
        }

        const created = await grnService.create(payload, "received");
        importedGrns += 1;
        importedItems += payload.items.length;

        const items = await grnService.getItems(created.id);
        const costingLines = items.map((item, index) => {
          const source = group[index]?.data;
          const saleRaw = map.salePrice && source ? source[map.salePrice].replace("£", "") : "";
          const sale = saleRaw ? Number(saleRaw) : NaN;
          const method: PricingMethod = Number.isFinite(sale) ? "MANUAL_OVERRIDE" : "AUTOMATIC";
          return {
            grnItemId: item.id,
            pricingMethod: method,
            salePriceEa: Number.isFinite(sale) ? sale : null,
            notes: "Imported",
          };
        });
        await costingService.saveGrnCosting(created.id, costingLines);
      } catch (error) {
        failures.push(`${grnNumber}: ${error instanceof Error ? error.message : "Import failed"}`);
      }
    }

    await activityService.log({
      action: "imported",
      entityType: "grn",
      entityId: "import",
      reference: "EXCEL",
      description: `Imported ${importedGrns} GRNs / ${importedItems} items from Excel`,
    });

    return {
      importedGrns,
      importedItems,
      skipped: preview.length - valid.length,
      failures,
    };
  },
};
