"use client";

import { useRouter } from "next/navigation";
import { PageHeader, PageHeaderLink } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { useLiveQuery } from "@/hooks/use-live-query";
import { partService } from "@/services/partService";
import { getDb } from "@/db/db";

export function PartsList() {
  const router = useRouter();
  const parts = useLiveQuery(() => partService.list(), []);
  const alts = useLiveQuery(() => getDb().alternatePartNumbers.toArray(), []);

  if (parts.loading) return <LoadingState />;
  if (parts.error) return <ErrorState message={parts.error} />;

  return (
    <div>
      <PageHeader
        title="Parts"
        description="Part master records. The same P/N can appear on many GRNs without duplicating the product."
        action={<PageHeaderLink href="/parts/new">New part</PageHeaderLink>}
      />
      <DataTable
        data={parts.data ?? []}
        searchPlaceholder="Search P/N, alternate or description"
        onRowClick={(row) => router.push(`/parts/${row.id}`)}
        columns={[
          { id: "partNumber", header: "P/N", accessor: (row) => row.partNumber },
          {
            id: "alts",
            header: "Alternate P/N",
            accessor: (row) =>
              (alts.data ?? [])
                .filter((item) => item.partId === row.id)
                .map((item) => item.alternateNumber)
                .join(" / "),
          },
          { id: "description", header: "Description", accessor: (row) => row.description },
          { id: "category", header: "Category", accessor: (row) => row.category },
          { id: "uom", header: "UOM", accessor: (row) => row.unitOfMeasure },
          { id: "status", header: "Status", accessor: (row) => row.status, cell: (row) => <StatusBadge value={row.status} /> },
        ]}
      />
    </div>
  );
}
