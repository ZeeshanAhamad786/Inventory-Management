"use client";
import { useParams } from "next/navigation";
import { SupplierDetailView } from "@/features/suppliers/suppliers-views";
export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  return <SupplierDetailView id={params.id} />;
}
