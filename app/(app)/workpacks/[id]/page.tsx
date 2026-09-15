"use client";
import { useParams } from "next/navigation";
import { WorkpackDetail } from "@/features/workpacks/workpacks-views";
export default function WorkpackDetailPage() {
  const params = useParams<{ id: string }>();
  return <WorkpackDetail id={params.id} />;
}
