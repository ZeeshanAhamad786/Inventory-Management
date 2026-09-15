"use client";
import { useParams } from "next/navigation";
import { SupplierForm } from "@/features/suppliers/supplier-form";
export default function EditSupplierPage() {
  const params = useParams<{ id: string }>();
  return <SupplierForm supplierId={params.id} />;
}
