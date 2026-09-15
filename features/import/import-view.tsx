"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { importService, type ImportColumnMap, type ParsedWorkbook } from "@/services/importService";

const mapFields: Array<{ key: keyof ImportColumnMap; label: string }> = [
  { key: "grnNumber", label: "GRN number" },
  { key: "date", label: "Date" },
  { key: "supplier", label: "Supplier" },
  { key: "invoice", label: "Invoice" },
  { key: "tracking", label: "Tracking" },
  { key: "batch", label: "Batch" },
  { key: "partNumber", label: "Part number" },
  { key: "alternate", label: "Alternate P/N" },
  { key: "serial", label: "Serial" },
  { key: "description", label: "Description" },
  { key: "quantity", label: "Quantity" },
  { key: "cost", label: "Purchase cost" },
  { key: "stores", label: "Stores" },
  { key: "workpack", label: "Workpack" },
  { key: "notes", label: "Notes" },
  { key: "salePrice", label: "Sale price" },
];

export function ImportView() {
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [sheet, setSheet] = useState("");
  const [map, setMap] = useState<ImportColumnMap>({});
  const [busy, setBusy] = useState(false);

  const current = sheet && workbook ? workbook.sheets[sheet] : null;
  const preview = useMemo(() => (current ? importService.preview(current.rows.slice(0, 50), map) : []), [current, map]);
  const validCount = preview.filter((row) => row.valid).length;
  const invalidCount = preview.filter((row) => !row.valid).length;

  return (
    <div>
      <PageHeader title="Excel import" description="Upload the original workbook, choose a sheet, map columns, preview and import. Invalid rows are not imported silently." />
      <Card className="mb-4">
        <CardHeader><CardTitle>1. Upload workbook</CardTitle></CardHeader>
        <CardContent>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const buffer = await file.arrayBuffer();
              const parsed = importService.parseWorkbook(buffer);
              setWorkbook(parsed);
              const first = parsed.sheetNames[0] ?? "";
              setSheet(first);
              setMap(importService.suggestMap(parsed.sheets[first]?.headers ?? []));
            }}
          />
        </CardContent>
      </Card>
      {workbook ? (
        <Card className="mb-4">
          <CardHeader><CardTitle>2. Select sheet and map columns</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <select
              className="h-9 rounded-md border bg-card px-3 text-sm"
              value={sheet}
              onChange={(event) => {
                setSheet(event.target.value);
                setMap(importService.suggestMap(workbook.sheets[event.target.value]?.headers ?? []));
              }}
            >
              {workbook.sheetNames.map((name) => <option key={name}>{name}</option>)}
            </select>
            <div className="grid gap-2 md:grid-cols-2">
              {mapFields.map((field) => (
                <label key={field.key} className="grid gap-1 text-sm">
                  <span>{field.label}</span>
                  <select
                    className="h-9 rounded-md border bg-card px-3"
                    value={map[field.key] ?? ""}
                    onChange={(event) => setMap((current) => ({ ...current, [field.key]: event.target.value || undefined }))}
                  >
                    <option value="">Not mapped</option>
                    {(current?.headers ?? []).map((header) => <option key={header}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
      {preview.length ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>3. Preview · {validCount} valid / {invalidCount} invalid (first 50 rows)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {preview.slice(0, 15).map((row) => (
              <div key={row.index} className="rounded-md border px-3 py-2">
                <div className="font-medium">Row {row.index} · {row.valid ? "Valid" : "Invalid"}</div>
                {row.errors.map((error) => <div key={error} className="text-destructive">{error}</div>)}
                {row.warnings.map((warning) => <div key={warning} className="text-amber-700">{warning}</div>)}
              </div>
            ))}
            <Button disabled={busy || validCount === 0} onClick={async () => {
              if (!current) return;
              setBusy(true);
              try {
                const result = await importService.importRows(current.rows, map);
                toast.success(`Imported ${result.importedGrns} GRNs / ${result.importedItems} items. Skipped ${result.skipped}.`);
                if (result.failures.length) toast.error(result.failures.slice(0, 3).join(" · "));
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Import failed");
              } finally {
                setBusy(false);
              }
            }}>{busy ? "Importing…" : "Import valid rows"}</Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
