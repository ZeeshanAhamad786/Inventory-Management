"use client";

import { useRouter } from "next/navigation";
import { PageHeader, PageHeaderLink } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState, ErrorState } from "@/components/shared/states";
import { useLiveQuery } from "@/hooks/use-live-query";
import { grnService } from "@/services/grnService";
import { getDb } from "@/db/db";
import { formatUkDate } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export function GrnList() {
  const router = useRouter();
  const grns = useLiveQuery(() => grnService.list(), []);
  const suppliers = useLiveQuery(() => getDb().suppliers.toArray(), []);
  const workpacks = useLiveQuery(() => getDb().workpacks.toArray(), []);
  const [status, setStatus] = useState("all");
  const [supplierId, setSupplierId] = useState("all");
  if (grns.loading) return <LoadingState />;
  if (grns.error) return <ErrorState message={grns.error} />;
  const rows = (grns.data ?? []).filter((grn) => {
    if (status !== "all" && grn.status !== status) return false;
    if (supplierId !== "all" && grn.supplierId !== supplierId) return false;
    return true;
  });
  return (
    <div>
      <PageHeader title="GRNs / Goods Received" description="Header plus line items. Historical receipts remain separate even when the same P/N is received again." action={<PageHeaderLink href="/grns/new">New GRN</PageHeaderLink>} />
      <DataTable
        data={rows}
        searchPlaceholder="Search GRN, invoice, tracking, batch"
        extraFilters={
          <div className="flex gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Supplier" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All suppliers</SelectItem>
                {(suppliers.data ?? []).map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        onRowClick={(row) => router.push(`/grns/${row.id}`)}
        columns={[
          { id: "grnNumber", header: "GRN", accessor: (row) => row.grnNumber },
          { id: "date", header: "Date", accessor: (row) => row.date, cell: (row) => formatUkDate(row.date) },
          { id: "supplier", header: "Supplier", accessor: (row) => (suppliers.data ?? []).find((s) => s.id === row.supplierId)?.name },
          { id: "invoice", header: "Invoice", accessor: (row) => row.invoice },
          { id: "tracking", header: "Tracking", accessor: (row) => row.supplierTrackingReference },
          { id: "workpack", header: "Workpack", accessor: (row) => (workpacks.data ?? []).find((w) => w.id === row.workpackId)?.workpackNumber },
          { id: "status", header: "Status", accessor: (row) => row.status, cell: (row) => <StatusBadge value={row.status} /> },
        ]}
      />
    </div>
  );
}
