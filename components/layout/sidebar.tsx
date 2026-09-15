"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Boxes,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Package,
  Settings,
  Tag,
  Truck,
  Warehouse,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/app-store";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    label: "Inventory",
    icon: Warehouse,
    children: [
      { href: "/inventory", label: "Stock" },
      { href: "/inventory/movements", label: "Stock Movements" },
    ],
  },
  {
    label: "GRNs",
    icon: ClipboardList,
    children: [
      { href: "/grns", label: "All GRNs" },
      { href: "/grns/new", label: "New GRN" },
    ],
  },
  {
    label: "Costing",
    icon: Tag,
    children: [
      { href: "/costing", label: "Costing" },
      { href: "/pricing-rules", label: "Pricing Rules" },
    ],
  },
  { href: "/parts", label: "Parts", icon: Package },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/workpacks", label: "Workpacks / Jobs", icon: Wrench },
  { href: "/settings/locations", label: "Stores / Locations", icon: Boxes },
  {
    label: "Reports",
    icon: FileSpreadsheet,
    children: [
      { href: "/reports/inventory", label: "Inventory" },
      { href: "/reports/grns", label: "GRNs" },
      { href: "/reports/costing", label: "Costing" },
      { href: "/reports/profit", label: "Profit" },
      { href: "/reports/suppliers", label: "Suppliers" },
      { href: "/reports/workpacks", label: "Workpacks" },
      { href: "/reports/movements", label: "Stock Movements" },
      { href: "/reports/locations", label: "Locations" },
    ],
  },
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/import", label: "Excel Import", icon: FileText },
  { href: "/activity", label: "Activity Log", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);

  return (
    <aside
      className={cn(
        "no-print hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex",
        collapsed ? "w-[72px]" : "w-[272px]",
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-sm font-bold">AS</div>
        {!collapsed ? (
          <div>
            <div className="text-sm font-semibold leading-tight">Ash Aviation</div>
            <div className="text-[11px] uppercase tracking-wide text-white/60">Stores & Costing</div>
          </div>
        ) : null}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {nav.map((item) => {
          if ("children" in item && item.children) {
            return (
              <div key={item.label} className="mb-2">
                <div className={cn("flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/50", collapsed && "justify-center")}>
                  <item.icon className="h-4 w-4" />
                  {!collapsed ? item.label : null}
                </div>
                {!collapsed
                  ? item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "mb-0.5 block rounded-md px-3 py-1.5 text-sm text-white/80 hover:bg-sidebar-accent",
                          pathname === child.href && "bg-sidebar-accent text-white",
                        )}
                      >
                        {child.label}
                      </Link>
                    ))
                  : null}
              </div>
            );
          }
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={cn(
                "mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent",
                collapsed && "justify-center px-0",
                active && "bg-sidebar-accent text-white",
              )}
              title={item.label}
            >
              <item.icon className="h-4 w-4" />
              {!collapsed ? item.label : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
