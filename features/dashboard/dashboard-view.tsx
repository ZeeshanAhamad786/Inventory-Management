"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { useLiveQuery } from "@/hooks/use-live-query";
import { dashboardService } from "@/services/dashboardService";
import { formatCompactGbp, formatGbp, formatNumber, formatUkDate } from "@/lib/format";
import { getDb } from "@/db/db";

export function DashboardView() {
  const stats = useLiveQuery(() => dashboardService.getStats(), []);
  const recentGrns = useLiveQuery(() => dashboardService.recentGrns(), []);
  const movements = useLiveQuery(() => dashboardService.recentMovements(), []);
  const workpacks = useLiveQuery(() => dashboardService.recentWorkpacks(), []);
  const lowStock = useLiveQuery(() => dashboardService.lowStock(), []);
  const costings = useLiveQuery(() => dashboardService.recentCostings(), []);
  const chart = useLiveQuery(() => dashboardService.grnsByMonth(), []);
  const parts = useLiveQuery(() => getDb().parts.toArray(), []);
  const suppliers = useLiveQuery(() => getDb().suppliers.toArray(), []);

  if (stats.loading || !stats.data) {
    return stats.error ? <ErrorState message={stats.error} /> : <LoadingState />;
  }

  const cards = [
    { label: "Total GRNs", value: formatNumber(stats.data.totalGrns) },
    { label: "Parts", value: formatNumber(stats.data.totalParts) },
    { label: "Stock quantity", value: formatNumber(stats.data.totalStockQty) },
    { label: "Stock cost value", value: formatGbp(stats.data.totalStockCostValue) },
    { label: "Potential sales", value: formatGbp(stats.data.potentialSalesValue) },
    { label: "Potential profit", value: formatGbp(stats.data.potentialProfit) },
    { label: "Suppliers", value: formatNumber(stats.data.supplierCount) },
    { label: "Active workpacks", value: formatNumber(stats.data.activeWorkpacks) },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Live stores position from the local database. Values update as GRNs, stock and costing change." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{card.value}</CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>GRNs over time</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Low / zero stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(lowStock.data ?? []).slice(0, 8).map((row) => (
              <Link key={row.partId} href={`/parts/${row.partId}`} className="flex items-center justify-between text-sm hover:underline">
                <span>{row.partNumber}</span>
                <span className={row.currentQty <= 0 ? "text-destructive" : "text-amber-700"}>{row.currentQty}</span>
              </Link>
            ))}
            {(lowStock.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No low-stock items.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent GRNs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(recentGrns.data ?? []).map((grn) => (
              <Link key={grn.id} href={`/grns/${grn.id}`} className="flex items-center justify-between text-sm">
                <span className="font-medium">{grn.grnNumber}</span>
                <span className="text-muted-foreground">{formatUkDate(grn.date)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent stock activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(movements.data ?? []).map((movement) => {
              const part = (parts.data ?? []).find((item) => item.id === movement.partId);
              return (
                <div key={movement.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{part?.partNumber ?? movement.partId}</div>
                    <div className="text-xs text-muted-foreground">{formatUkDate(movement.date)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={movement.type} />
                    <span>{movement.quantityChange > 0 ? `+${movement.quantityChange}` : movement.quantityChange}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Workpacks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(workpacks.data ?? []).map((workpack) => (
              <Link key={workpack.id} href={`/workpacks/${workpack.id}`} className="flex items-center justify-between text-sm">
                <span>{workpack.workpackNumber}</span>
                <StatusBadge value={workpack.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Recent costing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {(costings.data ?? []).map((row) => {
              const part = (parts.data ?? []).find((item) => item.id === row.partId);
              return (
                <Link key={row.id} href={`/costing/${row.grnId}`} className="rounded-lg border p-3 text-sm hover:bg-muted/40">
                  <div className="font-medium">{part?.partNumber}</div>
                  <div className="text-muted-foreground">{part?.description}</div>
                  <div className="mt-2 flex justify-between">
                    <span>{formatGbp(row.totalCost)}</span>
                    <StatusBadge value={row.pricingMethod} />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Value summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Stock cost</span><span>{formatCompactGbp(stats.data.totalStockCostValue)}</span></div>
            <div className="flex justify-between"><span>Potential sale</span><span>{formatCompactGbp(stats.data.potentialSalesValue)}</span></div>
            <div className="flex justify-between"><span>Potential profit</span><span>{formatCompactGbp(stats.data.potentialProfit)}</span></div>
            <div className="flex justify-between"><span>POA stock lines</span><span>{stats.data.poaItems}</span></div>
            <div className="flex justify-between"><span>Suppliers on file</span><span>{(suppliers.data ?? []).length}</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
