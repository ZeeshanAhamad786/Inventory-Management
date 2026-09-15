"use client";

import { useParams } from "next/navigation";
import { useLiveQuery } from "@/hooks/use-live-query";
import { grnService } from "@/services/grnService";
import { settingsService } from "@/services/settingsService";
import { formatGbp, formatGbpOrPoa, formatUkDate } from "@/lib/format";
import { sumCostings } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/shared/states";

export function GrnPrintView() {
  const params = useParams<{ id: string }>();
  const detail = useLiveQuery(() => grnService.getDetail(params.id), [params.id]);
  const settings = useLiveQuery(() => settingsService.get(), []);
  if (detail.loading || settings.loading) return <LoadingState />;
  if (!detail.data || !settings.data) return <ErrorState message="Unable to load print sheet" />;
  const { grn, items, supplier, workpack, parts, costings } = detail.data;
  const totals = sumCostings(costings);
  return (
    <div className="print-root mx-auto max-w-[210mm] bg-white p-8 text-black">
      <div className="no-print mb-4 flex gap-2">
        <Button onClick={() => window.print()}>Print</Button>
      </div>
      <div className="mb-6 flex items-start justify-between border-b-2 border-slate-800 pb-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500">Company</div>
          <div className="text-2xl font-semibold">{settings.data.companyName}</div>
          <div className="text-sm">{settings.data.companyAddress}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest">Goods received / costing</div>
          <div className="text-3xl font-bold">{grn.grnNumber}</div>
          <div>{formatUkDate(grn.date)}</div>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <Field label="Supplier" value={supplier?.name} />
        <Field label="Invoice" value={grn.invoice} />
        <Field label="Tracking" value={grn.supplierTrackingReference} />
        <Field label="Workpack No" value={workpack?.workpackNumber} />
        <Field label="Reg" value={grn.registration || workpack?.registration} />
        <Field label="Sheet no" value={`${grn.sheetNumber} of ${grn.totalSheets}`} />
        <Field label="Batch" value={grn.supplierBatchNumber} />
        <Field label="Total" value={totals.totalSale === null ? "POA" : formatGbp(totals.totalSale)} />
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="p-2 text-left">P/N</th>
            <th className="p-2 text-left">Description</th>
            <th className="p-2 text-right">Qty</th>
            <th className="p-2 text-right">Sale Price EA</th>
            <th className="p-2 text-right">Total Sale</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const part = parts.find((row) => row?.id === item.partId);
            const costing = costings.find((row) => row.grnItemId === item.id);
            return (
              <tr key={item.id} className="border-b">
                <td className="p-2">{part?.partNumber}</td>
                <td className="p-2">{item.description}</td>
                <td className="p-2 text-right">{item.quantity}</td>
                <td className="p-2 text-right">{formatGbpOrPoa(costing?.salePriceEa, costing?.pricingMethod === "POA")}</td>
                <td className="p-2 text-right">{formatGbpOrPoa(costing?.totalSale, costing?.pricingMethod === "POA")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-6 ml-auto w-64 space-y-1 text-sm">
        <div className="flex justify-between"><span>Total cost</span><span>{formatGbp(totals.totalCost)}</span></div>
        <div className="flex justify-between"><span>Total sale</span><span>{totals.totalSale === null ? "POA" : formatGbp(totals.totalSale)}</span></div>
        <div className="flex justify-between font-semibold"><span>Profit</span><span>{totals.profit === null ? "POA / Not calculated" : formatGbp(totals.profit)}</span></div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-slate-500">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}
