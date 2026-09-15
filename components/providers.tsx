"use client";

import { useEffect, useState } from "react";
import { seedIfEmpty } from "@/db/seed";
import { LoadingState, ErrorState } from "@/components/shared/states";

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
      <div className="flex min-h-screen items-center justify-center p-6">
        <ErrorState message={error} />
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Preparing local stores database…" />
      </div>
    );
  }

  return <>{children}</>;
}
