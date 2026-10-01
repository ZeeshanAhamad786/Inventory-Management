"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AeroSidebar, AeroMobileNav } from "@/components/aero/sidebar";
import { AeroHeader } from "@/components/aero/header";
import { useAuthStore } from "@/stores/app-store";
import { setServiceUser } from "@/services/sessionContext";
import { useMounted } from "@/hooks/use-live-query";
import { LoadingState } from "@/components/shared/states";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const mounted = useMounted();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user) setServiceUser(user);
  }, [user]);

  useEffect(() => {
    if (!mounted) return;
    if (!user) router.replace("/login");
  }, [mounted, user, router]);

  if (!mounted || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Checking session…" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AeroSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AeroMobileNav />
        <AeroHeader />
        <main className="flex-1 px-4 py-5 md:px-8 md:py-6">{children}</main>
      </div>
    </div>
  );
}
