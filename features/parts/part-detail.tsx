"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { useLiveQuery } from "@/hooks/use-live-query";
import { partService } from "@/services/partService";
import { inventoryService } from "@/services/inventoryService";
import { getDb } from "@/db/db";
import { formatGbp, formatGbpOrPoa, formatNumber, formatUkDate } from "@/lib/format";

export function PartDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const part = useLiveQuery(() => partService.get(id), [id]);
  const alts = useLiveQuery(() => partService.getAlternates(id), [id]);
  const qty = useLiveQuery(() => inventoryService.getQuantity(id), [id]);
  const movements = useLiveQuery(() => inventoryService.movementsForPart(id), [id]);
  const items = useLiveQuery(() => getDb().grnItems.where("partId").equals(id).toArray(), [id]);
  const grns = useLiveQuery(() => getDb().grns.toArray(), []);
  const workpacks = useLiveQuery(() => getDb().workpacks.toArray(), []);
  const costings = useLiveQuery(() => getDb().costings.where("partId").equals(id).toArray(), [id]);
  const lookup = useLiveQuery(() => partService.lookup(part.data?.partNumber ?? ""), [part.data?.partNumber]);

  if (part.loading) return <LoadingState />;
  if (!part.data) return <ErrorState message="Part not found" />;

  return (
    <div>
      <PageHeader
        title={part.data.partNumber}
        description={part.data.description}
        action={
          <Button asChild>
            <Link href={`/parts/${id}/edit`}>Edit</Link>
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Part information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Alternate P/N" value={(alts.data ?? []).map((item) => item.alternateNumber).join(" / ") || "—"} />
            <Row label="Category" value={part.data.category} />
            <Row label="UOM" value={part.data.unitOfMeasure} />
            <Row label="Status" value={<StatusBadge value={part.data.status} />} />
            <Row label="Current stock" value={formatNumber(qty.data ?? 0)} />
            <Row label="Last supplier" value={lookup.data?.lastSupplierName ?? "—"} />
            <Row label="Last / default cost" value={formatGbp(lookup.data?.lastCost ?? part.data.defaultCost)} />
            <Row label="Default sale" value={formatGbp(part.data.defaultSalePrice)} />
            <p className="pt-2 text-muted-foreground">{part.data.notes || "No notes."}</p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Stock movement history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(movements.data ?? []).map((movement) => {
              const grn = (grns.data ?? []).find((item) => item.id === movement.grnId);
              const workpack = (workpacks.data ?? []).find((item) => item.id === movement.workpackId);
              return (
                <div key={movement.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <div className="font-medium">
                      {grn?.grnNumber ?? workpack?.workpackNumber ?? movement.type} {movement.quantityChange > 0 ? `+${movement.quantityChange}` : movement.quantityChange}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatUkDate(movement.date)} · {movement.notes}
                    </div>
                  </div>
                  <StatusBadge value={movement.type} />
                </div>
              );
            })}
            <div className="pt-2 font-medium">Current: {formatNumber(qty.data ?? 0)}</div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>GRN history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(items.data ?? []).map((item) => {
              const grn = (grns.data ?? []).find((row) => row.id === item.grnId);
              return (
                <Link key={item.id} href={`/grns/${item.grnId}`} className="flex justify-between rounded-md border px-3 py-2 hover:bg-muted/40">
                  <span>{grn?.grnNumber} · qty {item.quantity}</span>
                  <span>{formatGbp(item.purchaseCostEa)}</span>
                </Link>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Workpack / costing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(costings.data ?? []).map((row) => (
              <Link key={row.id} href={`/costing/${row.grnId}`} className="block rounded-md border px-3 py-2 hover:bg-muted/40">
                <div>{formatGbpOrPoa(row.salePriceEa, row.pricingMethod === "POA")}</div>
                <StatusBadge value={row.pricingMethod} />
              </Link>
            ))}
            {(items.data ?? [])
              .map((item) => (workpacks.data ?? []).find((wp) => wp.id === item.workpackId))
              .filter(Boolean)
              .filter((wp, index, arr) => arr.findIndex((item) => item?.id === wp?.id) === index)
              .map((wp) => (
                <Link key={wp!.id} href={`/workpacks/${wp!.id}`} className="block text-sm hover:underline">
                  {wp!.workpackNumber}
                </Link>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
