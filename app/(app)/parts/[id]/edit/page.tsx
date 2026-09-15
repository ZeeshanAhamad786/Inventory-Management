"use client";
import { useParams } from "next/navigation";
import { PartForm } from "@/features/parts/part-form";
export default function EditPartPage() {
  const params = useParams<{ id: string }>();
  return <PartForm partId={params.id} />;
}
