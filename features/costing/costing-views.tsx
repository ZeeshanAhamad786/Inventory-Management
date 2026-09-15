"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { LoadingState, ErrorState } from "@/components/shared/states";
import { useLiveQuery } from "@/hooks/use-live-query";
import { grnService } from "@/services/grnService";
import { costingService } from "@/services/costingService";
import { pricingService } from "@/services/pricingService";
import { formatGbp, formatGbpOrPoa, formatPercent } from "@/lib/format";
import { sumCostings } from "@/lib/pricing";
import type { PricingMethod } from "@/types";

export function CostingHome() {
  const router = useRouter();
  const grns = useLiveQuery(() => grnService.list(), []);
  const [grnId, setGrnId] = useState<string | null>(null);
  return (
    <div>
      <PageHeader title="Costing" description="Select a GRN. Item information loads automatically — no VLOOKUP, no retyping." />
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row">
          <div className="flex-1">
            <SearchableSelect
              allowEmpty={false}
              value={grnId}
              onChange={setGrnId}
              placeholder="Select GRN"
              options={(grns.data ?? []).filter((g) => g.status !== "cancelled").map((g) => ({ value: g.id, label: g.grnNumber, hint: g.invoice }))}
            />
          </div>
          <Button disabled={!grnId} onClick={() => grnId && router.push(`/costing/${grnId}`)}>Open costing</Button>
        </CardContent>
      </Card>
      <div className="mt-4 grid gap-2">
        {(grns.data ?? []).slice(0, 8).map((grn) => (
          <Link key={grn.id} href={`/costing/${grn.id}`} className="flex justify-between rounded-md border bg-card px-3 py-2 text-sm">
            <span>{grn.grnNumber}</span>
            <StatusBadge value={grn.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}

interface LineState {
  grnItemId: string;
  pricingMethod: PricingMethod;
  salePriceEa: number | null;
  notes: string;
}

export function CostingWorkspace({ grnId }: { grnId: string }) {
  const detail = useLiveQuery(() => grnService.getDetail(grnId), [grnId]);
  const rules = useLiveQuery(() => pricingService.list(), []);
  const [overrides, setOverrides] = useState<Record<string, LineState>>({});
  const [previews, setPreviews] = useState<Record<string, Awaited<ReturnType<typeof costingService.previewLine>>>>({});

  const lines = useMemo<LineState[]>(() => {
    if (!detail.data) return [];
    return detail.data.items.map((item) => {
      const existing = detail.data!.costings.find((row) => row.grnItemId === item.id);
      const base: LineState = {
        grnItemId: item.id,
        pricingMethod: existing?.pricingMethod ?? "AUTOMATIC",
        salePriceEa: existing?.salePriceEa ?? null,
        notes: existing?.notes ?? "",
      };
      return overrides[item.id] ?? base;
    });
  }, [detail.data, overrides]);

  useEffect(() => {
    if (!detail.data) return;
    Promise.all(
      lines.map(async (line) => {
        const item = detail.data!.items.find((row) => row.id === line.grnItemId);
        if (!item) return null;
        const preview = await costingService.previewLine({
          quantity: item.quantity,
          purchaseCostEa: item.purchaseCostEa,
          pricingMethod: line.pricingMethod,
          salePriceEa: line.salePriceEa,
        });
        return [line.grnItemId, preview] as const;
      }),
    ).then((entries) => {
      const map: typeof previews = {};
      for (const entry of entries) if (entry) map[entry[0]] = entry[1];
      setPreviews(map);
    });
  }, [lines, detail.data]);

  const totals = useMemo(() => {
    const rows = Object.values(previews).map((preview) => ({
      totalCost: preview.totalCost,
      totalSale: preview.totalSale,
      profit: preview.profit,
      pricingMethod: preview.method,
    }));
    return sumCostings(rows);
  }, [previews]);

  if (detail.loading) return <LoadingState />;
  if (!detail.data) return <ErrorState message="GRN not found" />;
  const { grn, items, supplier, parts } = detail.data;

  return (
    <div>
      <PageHeader title={`Costing · ${grn.grnNumber}`} description={`${supplier?.name ?? ""} · ${items.length} items. Pricing rules apply automatically and can be overridden.`} />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Total cost" value={formatGbp(totals.totalCost)} />
        <Stat label="Total sale" value={formatGbpOrPoa(totals.totalSale, totals.totalSale === null)} />
        <Stat label="Profit" value={formatGbpOrPoa(totals.profit, totals.profit === null)} />
        <Stat label="Profit %" value={formatPercent(totals.profitPercent)} />
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const part = parts.find((row) => row?.id === item.partId);
          const line = lines.find((row) => row.grnItemId === item.id);
          const preview = previews[item.id];
          if (!line) return null;
          return (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                  <span>{part?.partNumber} · {item.description}</span>
                  <StatusBadge value={preview?.method ?? line.pricingMethod} />
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4 text-sm">
                <div>Qty {item.quantity}</div>
                <div>S/N {item.serialNumber || "—"}</div>
                <div>Supplier {supplier?.name}</div>
                <div>Cost EA {formatGbp(item.purchaseCostEa)}</div>
                <label className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Pricing method</span>
                  <select
                    className="h-9 rounded-md border bg-card px-3"
                    value={line.pricingMethod}
                    onChange={(event) => {
                      const method = event.target.value as PricingMethod;
                      setOverrides((current) => ({
                        ...current,
                        [item.id]: { ...line, pricingMethod: method },
                      }));
                    }}
                  >
                    <option value="AUTOMATIC">Automatic</option>
                    <option value="MANUAL_OVERRIDE">Manual override</option>
                    <option value="POA">POA</option>
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Sale price EA</span>
                  <Input
                    type="number"
                    step="0.01"
                    disabled={line.pricingMethod !== "MANUAL_OVERRIDE"}
                    value={line.pricingMethod === "MANUAL_OVERRIDE" ? (line.salePriceEa ?? "") : (preview?.salePriceEa ?? "")}
                    onChange={(event) => {
                      const value = event.target.value === "" ? null : Number(event.target.value);
                      setOverrides((current) => ({
                        ...current,
                        [item.id]: { ...line, salePriceEa: value },
                      }));
                    }}
                  />
                </label>
                <div>Total cost {formatGbp(preview?.totalCost)}</div>
                <div>Total sale {formatGbpOrPoa(preview?.totalSale, preview?.method === "POA")}</div>
                <div>Profit {formatGbpOrPoa(preview?.profit, preview?.method === "POA")}</div>
                <div>Profit % {formatPercent(preview?.profitPercent)}</div>
                <div className="md:col-span-4 text-xs text-muted-foreground">
                  Rule: {preview?.label ?? (rules.data ?? []).map((r) => r.label).join(", ")}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={async () => {
          try {
            await costingService.saveGrnCosting(grnId, lines);
            toast.success("Costing saved");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to save costing");
          }
        }}>Save costing</Button>
        <Button asChild variant="outline"><Link href={`/grns/${grnId}/print`}>Print / PDF</Link></Button>
      </div>
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
