import { getDb } from "@/db/db";

export interface SearchHit {
  type: "GRN" | "Part" | "Supplier" | "Workpack" | "Invoice" | "Serial" | "Batch" | "Tracking" | "Location";
  id: string;
  href: string;
  title: string;
  subtitle: string;
}

export const searchService = {
  async search(query: string, limit = 20): Promise<SearchHit[]> {
    const needle = query.trim().toLowerCase();
    if (needle.length < 1) return [];
    const [grns, parts, alts, suppliers, workpacks, items, locations] = await Promise.all([
      getDb().grns.toArray(),
      getDb().parts.toArray(),
      getDb().alternatePartNumbers.toArray(),
      getDb().suppliers.toArray(),
      getDb().workpacks.toArray(),
      getDb().grnItems.toArray(),
      getDb().locations.toArray(),
    ]);
    const hits: SearchHit[] = [];

    for (const grn of grns) {
      if (
        grn.grnNumber.toLowerCase().includes(needle) ||
        grn.invoice.toLowerCase().includes(needle) ||
        grn.supplierTrackingReference.toLowerCase().includes(needle) ||
        grn.supplierBatchNumber.toLowerCase().includes(needle)
      ) {
        const kind = grn.invoice.toLowerCase().includes(needle)
          ? "Invoice"
          : grn.supplierTrackingReference.toLowerCase().includes(needle)
            ? "Tracking"
            : grn.supplierBatchNumber.toLowerCase().includes(needle)
              ? "Batch"
              : "GRN";
        hits.push({
          type: kind,
          id: grn.id,
          href: `/grns/${grn.id}`,
          title: grn.grnNumber,
          subtitle: `${grn.invoice || "No invoice"} · ${grn.supplierTrackingReference || "No tracking"}`,
        });
      }
    }

    for (const part of parts) {
      const partAlts = alts.filter((alt) => alt.partId === part.id);
      const altMatch = partAlts.some((alt) => alt.alternateNumber.toLowerCase().includes(needle));
      if (
        part.partNumber.toLowerCase().includes(needle) ||
        part.description.toLowerCase().includes(needle) ||
        altMatch
      ) {
        hits.push({
          type: "Part",
          id: part.id,
          href: `/parts/${part.id}`,
          title: part.partNumber,
          subtitle: `${part.description}${partAlts.length ? ` · Alt: ${partAlts.map((a) => a.alternateNumber).join(", ")}` : ""}`,
        });
      }
    }

    for (const supplier of suppliers) {
      if (supplier.name.toLowerCase().includes(needle)) {
        hits.push({
          type: "Supplier",
          id: supplier.id,
          href: `/suppliers/${supplier.id}`,
          title: supplier.name,
          subtitle: supplier.contactPerson || supplier.email,
        });
      }
    }

    for (const workpack of workpacks) {
      if (
        workpack.workpackNumber.toLowerCase().includes(needle) ||
        workpack.title.toLowerCase().includes(needle) ||
        workpack.registration.toLowerCase().includes(needle)
      ) {
        hits.push({
          type: "Workpack",
          id: workpack.id,
          href: `/workpacks/${workpack.id}`,
          title: workpack.workpackNumber,
          subtitle: `${workpack.title} · ${workpack.registration || "No reg"}`,
        });
      }
    }

    for (const item of items) {
      if (item.serialNumber && item.serialNumber.toLowerCase().includes(needle)) {
        hits.push({
          type: "Serial",
          id: item.id,
          href: `/grns/${item.grnId}`,
          title: item.serialNumber,
          subtitle: `${item.description} · ${item.alternatePartNumber || item.partId}`,
        });
      }
      if (item.supplierBatchNumber && item.supplierBatchNumber.toLowerCase().includes(needle)) {
        hits.push({
          type: "Batch",
          id: item.id,
          href: `/grns/${item.grnId}`,
          title: item.supplierBatchNumber,
          subtitle: item.description,
        });
      }
    }

    for (const location of locations) {
      if (location.name.toLowerCase().includes(needle) || location.code.toLowerCase().includes(needle)) {
        hits.push({
          type: "Location",
          id: location.id,
          href: "/settings/locations",
          title: location.name,
          subtitle: location.code,
        });
      }
    }

    return hits.slice(0, limit);
  },
};
