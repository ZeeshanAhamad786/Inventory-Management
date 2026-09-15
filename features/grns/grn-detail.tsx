"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { LoadingState, ErrorState } from "@/components/shared/states";
import { useLiveQuery } from "@/hooks/use-live-query";
import { grnService } from "@/services/grnService";
import { settingsService } from "@/services/settingsService";
import { reportService } from "@/services/reportService";
import { documentService } from "@/services/documentService";
import { downloadGrnPdf } from "@/lib/pdf";
import { formatGbp, formatGbpOrPoa, formatUkDate } from "@/lib/format";
import { sumCostings } from "@/lib/pricing";

export function GrnDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const detail = useLiveQuery(() => grnService.getDetail(id), [id]);
  const settings = useLiveQuery(() => settingsService.get(), []);

  if (detail.loading) return <LoadingState />;
  if (!detail.data) return <ErrorState message="GRN not found" />;
  const { grn, items, supplier, workpack, documents, costings, parts, locations, workpacks } = detail.data;
  const totals = sumCostings(costings);

  return (
    <div>
      <PageHeader
        title={grn.grnNumber}
        description={`${formatUkDate(grn.date)} · ${supplier?.name ?? "No supplier"}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href={`/grns/${id}/edit`}>Edit</Link></Button>
            <Button asChild variant="outline"><Link href={`/costing/${id}`}>Cost this GRN</Link></Button>
            <Button asChild variant="outline"><Link href={`/grns/${id}/print`}>Print</Link></Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (!settings.data) return;
                await downloadGrnPdf({ settings: settings.data, grn, supplier, workpack, items, parts, costings });
                toast.success("PDF downloaded");
              }}
            >
              PDF
            </Button>
            <Button variant="outline" onClick={() => reportService.exportCsv("grns", { search: grn.grnNumber })}>Export</Button>
            <ConfirmButton
              title="Cancel this GRN?"
              description="The GRN will be cancelled and receipt quantities will be reversed from stock. It will not be permanently deleted."
              onConfirm={async () => {
                await grnService.setStatus(id, "cancelled");
                toast.success("GRN cancelled");
              }}
            >
              Cancel / archive
            </ConfirmButton>
          </div>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Meta label="Invoice" value={grn.invoice || "—"} />
        <Meta label="Tracking" value={grn.supplierTrackingReference || "—"} />
        <Meta label="Batch" value={grn.supplierBatchNumber || "—"} />
        <Meta label="Status" value={<StatusBadge value={grn.status} />} />
        <Meta label="Workpack" value={workpack?.workpackNumber || "—"} />
        <Meta label="Registration" value={grn.registration || workpack?.registration || "—"} />
        <Meta label="Sheet" value={`${grn.sheetNumber} of ${grn.totalSheets}`} />
        <Meta label="Total sale" value={formatGbpOrPoa(totals.totalSale, totals.totalSale === null)} />
      </div>
      <Card className="mb-4">
        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.map((item) => {
            const part = parts.find((row) => row?.id === item.partId);
            const location = locations.find((row) => row.id === item.locationId);
            const itemWp = workpacks.find((row) => row.id === item.workpackId);
            const costing = costings.find((row) => row.grnItemId === item.id);
            return (
              <div key={item.id} className="grid gap-2 rounded-lg border p-3 text-sm md:grid-cols-6">
                <div>
                  <Link className="font-medium hover:underline" href={`/parts/${item.partId}`}>{part?.partNumber}</Link>
                  <div className="text-xs text-muted-foreground">{item.alternatePartNumber}</div>
                </div>
                <div>{item.description}</div>
                <div>Qty {item.quantity}<div className="text-xs text-muted-foreground">S/N {item.serialNumber || "—"}</div></div>
                <div>{formatGbp(item.purchaseCostEa)} EA</div>
                <div>{location?.name || "—"}<div className="text-xs text-muted-foreground">{itemWp?.workpackNumber || "—"}</div></div>
                <div>{formatGbpOrPoa(costing?.salePriceEa, costing?.pricingMethod === "POA")}</div>
              </div>
            );
          })}
        </CardContent>
      </Card>
      {documents.length ? (
        <Card>
          <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {documents.map((doc) => (
              <div key={doc.id} className="flex justify-between">
                <span>{doc.fileName}</span>
                <Button variant="outline" size="sm" onClick={() => documentService.download(doc.id)}>Download</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <p className="mt-4 text-sm text-muted-foreground">{grn.notes}</p>
      <Button className="mt-4" variant="ghost" onClick={() => router.push("/grns")}>Back to GRNs</Button>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 text-sm">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
