"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { LoadingState, ErrorState } from "@/components/shared/states";
import { useLiveQuery } from "@/hooks/use-live-query";
import { inventoryService } from "@/services/inventoryService";
import { formatGbp, formatGbpOrPoa, formatNumber, formatUkDate } from "@/lib/format";
import { getDb } from "@/db/db";
import type { InventoryRow } from "@/types";
import type { StockIssueFormValues } from "@/schemas";

export function InventoryList() {
  const router = useRouter();
  const rows = useLiveQuery(() => inventoryService.listRows(), []);
  const locations = useLiveQuery(() => getDb().locations.toArray(), []);
  const [location, setLocation] = useState("all");
  const [adjusting, setAdjusting] = useState<InventoryRow | null>(null);
  if (rows.loading) return <LoadingState />;
  if (rows.error) return <ErrorState message={rows.error} />;
  const data = (rows.data ?? []).filter((row) => location === "all" || row.locationNames.includes(location));
  return (
    <div>
      <PageHeader title="Inventory" description="Current stock is calculated from movements, not a manually edited quantity field." />
      <DataTable
        data={data}
        searchPlaceholder="Search P/N, alternate, description, location"
        extraFilters={
          <SearchableSelect
            allowEmpty={false}
            value={location}
            onChange={(value) => setLocation(value ?? "all")}
            options={[{ value: "all", label: "All locations" }, ...(locations.data ?? []).map((loc) => ({ value: loc.name, label: loc.name }))]}
          />
        }
        onRowClick={(row) => router.push(`/parts/${row.partId}`)}
        columns={[
          { id: "partNumber", header: "P/N", accessor: (row) => row.partNumber },
          { id: "alternateNumbers", header: "Alternate P/N", accessor: (row) => row.alternateNumbers },
          { id: "description", header: "Description", accessor: (row) => row.description },
          { id: "currentQty", header: "Qty", accessor: (row) => row.currentQty, cell: (row) => formatNumber(row.currentQty) },
          { id: "costPrice", header: "Cost", accessor: (row) => row.costPrice, cell: (row) => formatGbp(row.costPrice) },
          { id: "stockCostValue", header: "Stock value", accessor: (row) => row.stockCostValue, cell: (row) => formatGbp(row.stockCostValue) },
          { id: "salePrice", header: "Sale", accessor: (row) => row.salePrice, cell: (row) => formatGbpOrPoa(row.salePrice, row.isPoa) },
          { id: "potentialSaleValue", header: "Potential sale", accessor: (row) => row.potentialSaleValue, cell: (row) => formatGbpOrPoa(row.potentialSaleValue, row.isPoa) },
          { id: "potentialProfit", header: "Potential profit", accessor: (row) => row.potentialProfit, cell: (row) => formatGbpOrPoa(row.potentialProfit, row.isPoa) },
          { id: "locationNames", header: "Location", accessor: (row) => row.locationNames },
          { id: "status", header: "Status", accessor: (row) => row.status, cell: (row) => <StatusBadge value={row.status} /> },
          {
            id: "actions",
            header: "",
            cell: (row) => (
              <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); setAdjusting(row); }}>
                Adjust
              </Button>
            ),
          },
        ]}
      />
      <AdjustDialog row={adjusting} onClose={() => setAdjusting(null)} />
    </div>
  );
}

function AdjustDialog({ row, onClose }: { row: InventoryRow | null; onClose: () => void }) {
  const workpacks = useLiveQuery(() => getDb().workpacks.toArray(), []);
  const locations = useLiveQuery(() => getDb().locations.toArray(), []);
  const [quantity, setQuantity] = useState(1);
  const [type, setType] = useState<StockIssueFormValues["type"]>("ISSUE");
  const [workpackId, setWorkpackId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  return (
    <Dialog open={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Stock movement · {row?.partNumber}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Type">
            <select className="h-9 w-full rounded-md border bg-card px-3 text-sm" value={type} onChange={(e) => setType(e.target.value as StockIssueFormValues["type"])}>
              <option value="ISSUE">Issue</option>
              <option value="ADJUSTMENT_IN">Adjustment in</option>
              <option value="ADJUSTMENT_OUT">Adjustment out</option>
              <option value="RETURN">Return</option>
              <option value="TRANSFER">Transfer out</option>
            </select>
          </Field>
          <Field label="Quantity"><Input type="number" min={0.01} step="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /></Field>
          <Field label="Workpack"><SearchableSelect value={workpackId} onChange={setWorkpackId} options={(workpacks.data ?? []).map((wp) => ({ value: wp.id, label: wp.workpackNumber }))} /></Field>
          <Field label="Location"><SearchableSelect value={locationId} onChange={setLocationId} options={(locations.data ?? []).map((loc) => ({ value: loc.id, label: loc.name }))} /></Field>
          <Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Button onClick={async () => {
            if (!row) return;
            try {
              await inventoryService.adjust({ partId: row.partId, quantity, type, workpackId, locationId, notes });
              toast.success("Stock movement recorded");
              onClose();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Unable to adjust stock");
            }
          }}>Save movement</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MovementsList() {
  const rows = useLiveQuery(() => inventoryService.listMovements(), []);
  const parts = useLiveQuery(() => getDb().parts.toArray(), []);
  const grns = useLiveQuery(() => getDb().grns.toArray(), []);
  const workpacks = useLiveQuery(() => getDb().workpacks.toArray(), []);
  if (rows.loading) return <LoadingState />;
  if (rows.error) return <ErrorState message={rows.error} />;
  return (
    <div>
      <PageHeader title="Stock movements" description="Every receipt, issue, return and adjustment is stored as a movement." />
      <DataTable
        data={rows.data ?? []}
        columns={[
          { id: "date", header: "Date", accessor: (row) => row.date, cell: (row) => formatUkDate(row.date) },
          { id: "part", header: "P/N", accessor: (row) => (parts.data ?? []).find((p) => p.id === row.partId)?.partNumber },
          { id: "type", header: "Type", accessor: (row) => row.type, cell: (row) => <StatusBadge value={row.type} /> },
          { id: "qty", header: "Qty", accessor: (row) => row.quantityChange },
          { id: "grn", header: "GRN", accessor: (row) => (grns.data ?? []).find((g) => g.id === row.grnId)?.grnNumber },
          { id: "workpack", header: "Workpack", accessor: (row) => (workpacks.data ?? []).find((w) => w.id === row.workpackId)?.workpackNumber },
          { id: "notes", header: "Notes", accessor: (row) => row.notes },
        ]}
      />
    </div>
  );
}
