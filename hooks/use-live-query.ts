"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { liveQuery } from "dexie";

export function useLiveQuery<T>(querier: () => Promise<T> | T, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const subscription = liveQuery(querier).subscribe({
      next: (value) => {
        if (cancelled) return;
        setData(value);
        setError(null);
        setLoading(false);
      },
      error: (err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load data");
        setLoading(false);
      },
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

export function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
