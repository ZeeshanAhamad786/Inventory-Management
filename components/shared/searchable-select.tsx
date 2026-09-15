"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select",
  allowEmpty = true,
}: {
  options: Array<{ value: string; label: string; hint?: string }>;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) || (option.hint ?? "").toLowerCase().includes(needle),
    );
  }, [options, query]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 text-left text-sm shadow-sm",
        )}
      >
        <span className={selected ? "" : "text-muted-foreground"}>{selected?.label ?? placeholder}</span>
        <span className="text-xs text-muted-foreground">▾</span>
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-full rounded-md border bg-popover p-2 shadow-md">
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search…"
            className="mb-2"
          />
          <div className="max-h-56 overflow-auto">
            {allowEmpty ? (
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                None
              </button>
            ) : null}
            {filtered.map((option) => (
              <button
                type="button"
                key={option.value}
                className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <div>{option.label}</div>
                {option.hint ? <div className="text-xs text-muted-foreground">{option.hint}</div> : null}
              </button>
            ))}
            {filtered.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">No matches</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
