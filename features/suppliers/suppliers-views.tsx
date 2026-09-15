"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader, PageHeaderLink } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState, ErrorState } from "@/components/shared/states";
import { useLiveQuery } from "@/hooks/use-live-query";
import { supplierService } from "@/services/supplierService";
import { formatGbp, formatNumber } from "@/lib/format";

export function SuppliersList() {
  const router = useRouter();
  const suppliers = useLiveQuery(() => supplierService.list(), []);
  if (suppliers.loading) return <LoadingState />;
  if (suppliers.error) return <ErrorState message={suppliers.error} />;
  return (
    <div>
      <PageHeader title="Suppliers" description="Vendor records used on GRNs and purchase history." action={<PageHeaderLink href="/suppliers/new">New supplier</PageHeaderLink>} />
      <DataTable
        data={suppliers.data ?? []}
        onRowClick={(row) => router.push(`/suppliers/${row.id}`)}
        columns={[
          { id: "name", header: "Name", accessor: (row) => row.name },
          { id: "contactPerson", header: "Contact", accessor: (row) => row.contactPerson },
          { id: "email", header: "Email", accessor: (row) => row.email },
          { id: "phone", header: "Phone", accessor: (row) => row.phone },
          { id: "status", header: "Status", accessor: (row) => row.status, cell: (row) => <StatusBadge value={row.status} /> },
        ]}
      />
    </div>
  );
}

export function SupplierDetailView({ id }: { id: string }) {
  const detail = useLiveQuery(() => supplierService.getDetail(id), [id]);
  if (detail.loading) return <LoadingState />;
  if (!detail.data) return <ErrorState message="Supplier not found" />;
  const { supplier, grns, parts, totalQuantity, totalPurchaseValue } = detail.data;
  return (
    <div>
      <PageHeader
        title={supplier.name}
        description={`${supplier.contactPerson} · ${supplier.email}`}
        action={<PageHeaderLink href={`/suppliers/${id}/edit`}>Edit</PageHeaderLink>}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="GRNs" value={String(grns.length)} />
        <Stat label="Total quantity" value={formatNumber(totalQuantity)} />
        <Stat label="Purchase value" value={formatGbp(totalPurchaseValue)} />
      </div>
      <h2 className="mb-2 text-sm font-semibold">Recent receipts</h2>
      <div className="mb-6 space-y-2">
        {grns.map((grn) => (
          <Link key={grn.id} href={`/grns/${grn.id}`} className="flex justify-between rounded-md border bg-card px-3 py-2 text-sm">
            <span>{grn.grnNumber}</span>
            <StatusBadge value={grn.status} />
          </Link>
        ))}
      </div>
      <h2 className="mb-2 text-sm font-semibold">Parts supplied</h2>
      <div className="flex flex-wrap gap-2">
        {parts.map((part) => (
          <Link key={part!.id} href={`/parts/${part!.id}`} className="rounded-full border px-3 py-1 text-sm">
            {part!.partNumber}
          </Link>
        ))}
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
