"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function InventoryPartRedirect() {
  const params = useParams<{ partId: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/parts/${params.partId}`);
  }, [params.partId, router]);
  return <p className="text-sm text-muted-foreground">Opening part detail…</p>;
}
