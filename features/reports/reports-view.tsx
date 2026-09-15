"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { reportService, type ReportFilters, type ReportType } from "@/services/reportService";
import { useLiveQuery } from "@/hooks/use-live-query";
import { getDb } from "@/db/db";
import { formatGbp, formatGbpOrPoa, formatPercent } from "@/lib/format";
import { LoadingState, ErrorState } from "@/components/shared/states";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { activityService } from "@/services/activityService";

const reportMeta: Record<ReportType, { title: string; description: string }> = {
  inventory: { title: "Inventory report", description: "Current stock, cost, sale value and location." },
  grns: { title: "GRN report", description: "Goods received, suppliers, quantities and purchase value." },
  costing: { title: "Costing report", description: "Line-level cost, sale and profit." },
  profit: { title: "Profit report", description: "Total cost, sale, profit and profit % with filters." },
  suppliers: { title: "Supplier report", description: "Receipt volume and purchase value by supplier." },
  workpacks: { title: "Workpack report", description: "Parts, quantities and value by job." },
  movements: { title: "Stock movement report", description: "Receipts, issues and adjustments." },
  locations: { title: "Location / stores report", description: "Stock held in each store." },
};

export function ReportsHome() {
  return (
    <div>
      <PageHeader title="Reports" description="All figures come from the local database. Export CSV or print to PDF." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(reportMeta) as ReportType[]).map((type) => (
          <Link key={type} href={`/reports/${type}`} className="rounded-xl border bg-card p-4 hover:bg-muted/40">
            <div className="font-semibold">{reportMeta[type].title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{reportMeta[type].description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ReportView({ type }: { type: ReportType }) {
  const meta = reportMeta[type];
  const [filters, setFilters] = useState<ReportFilters>({});
  const suppliers = useLiveQuery(() => getDb().suppliers.toArray(), []);
  const parts = useLiveQuery(() => getDb().parts.toArray(), []);
  const workpacks = useLiveQuery(() => getDb().workpacks.toArray(), []);
  const table = useLiveQuery(() => reportService.toTable(type, filters), [type, filters.from, filters.to, filters.search, filters.supplierId, filters.partId, filters.workpackId]);
  const profit = useLiveQuery(() => (type === "profit" ? reportService.profit(filters) : Promise.resolve(null)), [type, filters]);

  async function exportPdf() {
    if (!table.data) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text(meta.title, 14, 12);
    autoTable(doc, { startY: 18, head: [table.data.headers], body: table.data.rows.map((row) => row.map((cell) => String(cell ?? ""))) });
    doc.save(`${type}-report.pdf`);
    await activityService.log({
      action: "report_generated",
      entityType: "report",
      entityId: type,
      reference: type,
      description: `Downloaded ${type} report PDF`,
    });
    toast.success("PDF downloaded");
  }

  if (!meta) return <ErrorState message="Unknown report" />;

  return (
    <div>
      <PageHeader title={meta.title} description={meta.description} />
      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-6 md:grid-cols-4">
          <Input type="date" value={filters.from ?? ""} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))} />
          <Input type="date" value={filters.to ?? ""} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))} />
          <Input placeholder="Search" value={filters.search ?? ""} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
          <SearchableSelect value={filters.supplierId ?? null} onChange={(value) => setFilters((f) => ({ ...f, supplierId: value ?? undefined }))} options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }))} placeholder="Supplier" />
          <SearchableSelect value={filters.partId ?? null} onChange={(value) => setFilters((f) => ({ ...f, partId: value ?? undefined }))} options={(parts.data ?? []).map((p) => ({ value: p.id, label: p.partNumber }))} placeholder="Part" />
          <SearchableSelect value={filters.workpackId ?? null} onChange={(value) => setFilters((f) => ({ ...f, workpackId: value ?? undefined }))} options={(workpacks.data ?? []).map((w) => ({ value: w.id, label: w.workpackNumber }))} placeholder="Workpack" />
          <Button onClick={() => reportService.exportCsv(type, filters)}>Export CSV</Button>
          <Button variant="outline" onClick={exportPdf}>Export PDF</Button>
        </CardContent>
      </Card>
      {type === "profit" && profit.data ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <Stat label="Total cost" value={formatGbp(profit.data.totals.totalCost)} />
          <Stat label="Total sale" value={formatGbpOrPoa(profit.data.totals.totalSale, profit.data.totals.totalSale === null)} />
          <Stat label="Total profit" value={formatGbpOrPoa(profit.data.totals.profit, profit.data.totals.profit === null)} />
          <Stat label="Profit %" value={formatPercent(profit.data.totals.profitPercent)} />
        </div>
      ) : null}
      {table.loading ? <LoadingState /> : table.error ? <ErrorState message={table.error} /> : (
        <div className="overflow-auto rounded-xl border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>{table.data?.headers.map((header) => <th key={header} className="p-2 text-left">{header}</th>)}</tr>
            </thead>
            <tbody>
              {table.data?.rows.map((row, index) => (
                <tr key={index} className="border-t">
                  {row.map((cell, cellIndex) => <td key={cellIndex} className="p-2">{String(cell ?? "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
