"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLiveQuery } from "@/hooks/use-live-query";
import { jobService } from "@/services/aero/jobService";
import { receiptService } from "@/services/aero/receiptService";

type CountKey = "jobs" | "inventory" | "out" | "completed" | "usedUp" | "history";

type NavItem = {
  href: string;
  label: string;
  countKey: CountKey | null;
};

const nav: Array<{ group: string; items: NavItem[] }> = [
  {
    group: "Workshop",
    items: [
      { href: "/jobs", label: "Jobs", countKey: "jobs" },
      { href: "/add-parts", label: "Add parts", countKey: null },
    ],
  },
  {
    group: "Stores",
    items: [
      { href: "/inventory", label: "Inventory", countKey: "inventory" },
      { href: "/out", label: "Out with someone", countKey: "out" },
    ],
  },
  {
    group: "Records",
    items: [
      { href: "/completed", label: "Completed jobs", countKey: "completed" },
      { href: "/used-up", label: "Used-up parts", countKey: "usedUp" },
      { href: "/history", label: "History", countKey: null },
    ],
  },
];

function useNavCounts() {
  const jobs = useLiveQuery(() => jobService.counts(), []);
  const receipts = useLiveQuery(() => receiptService.counts(), []);
  return {
    jobs: jobs.data?.open ?? 0,
    inventory: receipts.data?.lineCountInBoxes ?? 0,
    out: receipts.data?.lineCountOut ?? 0,
    completed: jobs.data?.completed ?? 0,
    usedUp: jobs.data?.usedUp ?? 0,
    history: jobs.data?.history ?? 0,
  } satisfies Record<CountKey, number>;
}

export function AeroSidebar() {
  const pathname = usePathname();
  const counts = useNavCounts();

  return (
    <aside className="hidden h-screen w-[248px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="px-5 pb-3 pt-6">
        <div className="text-[22px] font-bold leading-none tracking-tight text-foreground">Aeroswift</div>
        <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Parts Control
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
        {nav.map((section) => (
          <div key={section.group} className="mb-5">
            <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {section.group}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/jobs" && pathname.startsWith(`${item.href}/`)) ||
                  (item.href === "/jobs" && pathname.startsWith("/jobs"));
                const count = item.countKey ? counts[item.countKey] : null;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 text-[14px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      active && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
                    )}
                  >
                    <span>{item.label}</span>
                    {count != null ? <span className="text-[13px] font-medium text-muted-foreground">{count}</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground">
            AS
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Aeroswift</span> workshop.
          </div>
        </div>
      </div>
    </aside>
  );
}

export function AeroMobileNav() {
  const pathname = usePathname();
  const counts = useNavCounts();
  const items = nav.flatMap((s) => s.items);

  return (
    <div className="border-b border-border bg-card md:hidden">
      <div className="px-4 pb-2 pt-4">
        <div className="text-lg font-bold leading-none text-foreground">Aeroswift</div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Parts Control
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto px-3 pb-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const count = item.countKey ? counts[item.countKey] : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-muted-foreground",
                active && "bg-accent font-semibold text-foreground",
              )}
            >
              {item.label}
              {count != null ? <span className="ml-1 text-muted-foreground">{count}</span> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
