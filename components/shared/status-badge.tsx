"use client";

import { Badge } from "@/components/ui/badge";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "success" | "warning" | "danger" }> = {
  active: { label: "Active", variant: "success" },
  inactive: { label: "Inactive", variant: "secondary" },
  received: { label: "Received", variant: "success" },
  draft: { label: "Draft", variant: "warning" },
  cancelled: { label: "Cancelled", variant: "danger" },
  archived: { label: "Archived", variant: "secondary" },
  open: { label: "Open", variant: "default" },
  in_progress: { label: "In progress", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  AUTOMATIC: { label: "Automatic", variant: "default" },
  MANUAL_OVERRIDE: { label: "Manual", variant: "warning" },
  POA: { label: "POA", variant: "danger" },
  RECEIPT: { label: "Receipt", variant: "success" },
  ISSUE: { label: "Issue", variant: "warning" },
  ADJUSTMENT_IN: { label: "Adj in", variant: "success" },
  ADJUSTMENT_OUT: { label: "Adj out", variant: "danger" },
  RETURN: { label: "Return", variant: "default" },
  TRANSFER: { label: "Transfer", variant: "outline" },
};

export function StatusBadge({ value }: { value: string }) {
  const mapped = statusMap[value] ?? { label: value.replaceAll("_", " "), variant: "outline" as const };
  return <Badge variant={mapped.variant}>{mapped.label}</Badge>;
}
