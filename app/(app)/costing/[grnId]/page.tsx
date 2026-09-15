"use client";
import { useParams } from "next/navigation";
import { CostingWorkspace } from "@/features/costing/costing-views";
export default function CostingGrnPage() {
  const params = useParams<{ grnId: string }>();
  return <CostingWorkspace grnId={params.grnId} />;
}
