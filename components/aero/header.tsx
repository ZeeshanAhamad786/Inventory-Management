"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuthStore, useUiStore } from "@/stores/app-store";
import { receiptService } from "@/services/aero/receiptService";
import { jobService } from "@/services/aero/jobService";

type Hit = { type: string; title: string; subtitle: string; href: string };

export function AeroHeader() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const darkMode = useUiStore((s) => s.darkMode);
  const setDarkMode = useUiStore((s) => s.setDarkMode);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      const needle = query.trim().toLowerCase();
      const [lines, jobs] = await Promise.all([receiptService.search(query), jobService.list()]);
      const next: Hit[] = [
        ...lines.slice(0, 8).map((line) => ({
          type: "GRN",
          title: `GR ${line.grNumber} · ${line.partNumber}`,
          subtitle: `${line.description} · ${line.batchNumber || "no batch"}`,
          href: line.jobId ? `/jobs/${line.jobId}` : "/inventory",
        })),
        ...jobs
          .filter((j) =>
            `${j.jobNumber} ${j.title} ${j.registration} ${j.customer} ${j.engineSerial}`.toLowerCase().includes(needle),
          )
          .slice(0, 5)
          .map((j) => ({
            type: "Job",
            title: j.jobNumber,
            subtitle: `${j.title} · ${j.engineType} · ${j.registration}`,
            href: `/jobs/${j.id}`,
          })),
      ];
      setHits(next);
    }, 160);
    return () => window.clearTimeout(handle);
  }, [query]);

  const placeholder = useMemo(() => "Search part number, serial, GRN, box, job or person", []);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:px-8">
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="h-11 rounded-full border-border bg-card pl-10 text-[14px] text-foreground shadow-none"
          />
          {hits.length > 0 ? (
            <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
              {hits.map((hit) => (
                <button
                  key={`${hit.type}-${hit.title}-${hit.href}`}
                  type="button"
                  className="block w-full px-3 py-2.5 text-left hover:bg-muted"
                  onClick={() => {
                    router.push(hit.href);
                    setQuery("");
                    setHits([]);
                  }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{hit.type}</div>
                  <div className="text-sm font-medium text-foreground">{hit.title}</div>
                  <div className="text-xs text-muted-foreground">{hit.subtitle}</div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <label className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
          <span>Theme</span>
          <select
            className="h-9 rounded-lg border border-border bg-card px-2 text-sm text-foreground"
            value={darkMode ? "dark" : "light"}
            onChange={(e) => setDarkMode(e.target.value === "dark")}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <button
          type="button"
          className="hidden text-xs text-muted-foreground hover:text-foreground sm:block"
          onClick={() => {
            logout();
            router.replace("/login");
          }}
          title={user?.name ? `Signed in as ${user.name}` : "Sign out"}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
