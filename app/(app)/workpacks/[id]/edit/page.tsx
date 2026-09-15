"use client";
import { useParams } from "next/navigation";
import { WorkpackForm } from "@/features/workpacks/workpacks-views";
export default function EditWorkpackPage() {
  const params = useParams<{ id: string }>();
  return <WorkpackForm workpackId={params.id} />;
}
