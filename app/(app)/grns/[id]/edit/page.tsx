"use client";
import { useParams } from "next/navigation";
import { GrnForm } from "@/features/grns/grn-form";
export default function EditGrnPage() {
  const params = useParams<{ id: string }>();
  return <GrnForm grnId={params.id} />;
}
