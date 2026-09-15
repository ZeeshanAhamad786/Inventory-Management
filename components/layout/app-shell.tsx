"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useAuthStore } from "@/stores/app-store";
import { setServiceUser } from "@/services/sessionContext";
import { useMounted } from "@/hooks/use-live-query";
import { LoadingState } from "@/components/shared/states";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
    return <LoadingState label="Checking session…" />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 p-4 md:p-6" data-path={pathname}>
          {children}
        </main>
      </div>
    </div>
  );
}
