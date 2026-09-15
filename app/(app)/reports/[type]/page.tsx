"use client";
import { useParams } from "next/navigation";
import { ReportView } from "@/features/reports/reports-view";
import type { ReportType } from "@/services/reportService";

const allowed: ReportType[] = ["inventory", "grns", "costing", "profit", "suppliers", "workpacks", "movements", "locations"];

export default function ReportTypePage() {
  const params = useParams<{ type: string }>();
  const type = allowed.includes(params.type as ReportType) ? (params.type as ReportType) : "inventory";
  return <ReportView type={type} />;
}
