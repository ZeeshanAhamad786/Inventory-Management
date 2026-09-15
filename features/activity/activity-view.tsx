"use client";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { useLiveQuery } from "@/hooks/use-live-query";
import { activityService } from "@/services/activityService";
import { formatUkDateTime } from "@/lib/format";
import { LoadingState, ErrorState } from "@/components/shared/states";

export function ActivityView() {
  const rows = useLiveQuery(() => activityService.list(400), []);
  if (rows.loading) return <LoadingState />;
  if (rows.error) return <ErrorState message={rows.error} />;
  return (
    <div>
      <PageHeader title="Activity log" description="Creates, updates, stock movements, price changes and imports. Transactional records are cancelled or archived rather than deleted." />
      <DataTable
        data={rows.data ?? []}
        columns={[
          { id: "date", header: "Date/time", accessor: (row) => row.date, cell: (row) => formatUkDateTime(row.date) },
          { id: "userName", header: "User", accessor: (row) => row.userName },
          { id: "action", header: "Action", accessor: (row) => row.action },
          { id: "entityType", header: "Entity", accessor: (row) => row.entityType },
          { id: "reference", header: "Reference", accessor: (row) => row.reference },
          { id: "description", header: "Description", accessor: (row) => row.description },
        ]}
      />
    </div>
  );
}
