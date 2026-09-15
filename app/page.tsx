"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/app-store";
import { useMounted } from "@/hooks/use-live-query";

export default function HomePage() {
  const router = useRouter();
  const mounted = useMounted();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!mounted) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [mounted, user, router]);

  return <div className="p-8 text-sm text-muted-foreground">Opening Ash Aviation Stores…</div>;
}
