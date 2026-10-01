"use client";

import { useEffect, useState } from "react";
import { seedIfEmpty } from "@/db/aero-seed";
import { LoadingState, ErrorState } from "@/components/shared/states";
import { useUiStore } from "@/stores/app-store";

function ThemeSync() {
  const darkMode = useUiStore((s) => s.darkMode);

  useEffect(() => {
    const apply = (value: boolean) => {
      document.documentElement.classList.toggle("dark", value);
    };
    apply(darkMode);
    const unsub = useUiStore.persist.onFinishHydration((state) => {
      apply(state?.darkMode ?? false);
    });
    return unsub;
  }, [darkMode]);

  return null;
}

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    seedIfEmpty()
      .then(() => setReady(true))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to start local database"));
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <ErrorState message={error} />
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <ThemeSync />
        <LoadingState label="Preparing Parts Control…" />
      </div>
    );
  }

  return (
    <>
      <ThemeSync />
      {children}
    </>
  );
}
