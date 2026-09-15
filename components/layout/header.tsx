"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore, useUiStore } from "@/stores/app-store";
import { searchService, type SearchHit } from "@/services/searchService";

export function Header() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const shownHits = query.trim() ? hits : [];

  useEffect(() => {
    if (!query.trim()) return;
    const handle = window.setTimeout(() => {
      searchService.search(query).then(setHits);
    }, 180);
    return () => window.clearTimeout(handle);
  }, [query]);

  return (
    <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur">
      <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
        <Menu className="h-4 w-4" />
      </Button>
      <div className="relative max-w-xl flex-1">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search GRN, P/N, alternate, supplier, invoice, serial, batch, workpack, location"
          className="pl-9"
        />
        {shownHits.length > 0 ? (
          <div className="absolute z-30 mt-1 w-full rounded-md border bg-popover shadow-md">
            {shownHits.map((hit) => (
              <button
                key={`${hit.type}-${hit.id}-${hit.title}`}
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-muted"
                onClick={() => {
                  router.push(hit.href);
                  setQuery("");
                  setHits([]);
                }}
              >
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{hit.type}</div>
                <div className="text-sm font-medium">{hit.title}</div>
                <div className="text-xs text-muted-foreground">{hit.subtitle}</div>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="ml-auto flex items-center gap-3 text-sm">
        <div className="hidden text-right sm:block">
          <div className="font-medium">{user?.name}</div>
          <div className="text-xs text-muted-foreground">{user?.email}</div>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            logout();
            router.replace("/login");
          }}
        >
          Sign out
        </Button>
      </div>
    </header>
  );
}
