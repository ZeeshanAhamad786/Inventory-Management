"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { grnSchema, type GrnFormValues } from "@/schemas";
import { grnService } from "@/services/grnService";
import { partService } from "@/services/partService";
import { documentService } from "@/services/documentService";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { useLiveQuery } from "@/hooks/use-live-query";
import { getDb } from "@/db/db";
import { formatGbp, formatNumber, fromDateInputValue, toDateInputValue } from "@/lib/format";
import type { PartLookup } from "@/types";

const emptyItem = {
  partId: "",
  alternatePartNumber: "",
  serialNumber: "",
  description: "",
  quantity: 1,
  supplierBatchNumber: "",
  purchaseCostEa: 0,
  locationId: null as string | null,
  workpackId: null as string | null,
  notes: "",
};

export function GrnForm({ grnId }: { grnId?: string }) {
  const router = useRouter();
  const suppliers = useLiveQuery(() => getDb().suppliers.toArray(), []);
  const parts = useLiveQuery(() => partService.list(), []);
  const alts = useLiveQuery(() => getDb().alternatePartNumbers.toArray(), []);
  const locations = useLiveQuery(() => getDb().locations.toArray(), []);
  const workpacks = useLiveQuery(() => getDb().workpacks.toArray(), []);
  const [lookups, setLookups] = useState<Record<number, PartLookup | null>>({});
  const [file, setFile] = useState<File | null>(null);

  const form = useForm<GrnFormValues>({
    resolver: zodResolver(grnSchema),
    defaultValues: {
      grnNumber: "",
      date: new Date().toISOString(),
      supplierId: "",
      invoice: "",
      supplierTrackingReference: "",
      supplierBatchNumber: "",
      workpackId: null,
      registration: "",
      sheetNumber: 1,
      totalSheets: 1,
      notes: "",
      items: [emptyItem],
    },
  });
  const items = useFieldArray({ control: form.control, name: "items" });

  useEffect(() => {
    if (grnId) {
      grnService.getDetail(grnId).then((detail) => {
        if (!detail) return;
        form.reset({
          grnNumber: detail.grn.grnNumber,
          date: detail.grn.date,
          supplierId: detail.grn.supplierId,
          invoice: detail.grn.invoice,
          supplierTrackingReference: detail.grn.supplierTrackingReference,
          supplierBatchNumber: detail.grn.supplierBatchNumber,
          workpackId: detail.grn.workpackId,
          registration: detail.grn.registration,
          sheetNumber: detail.grn.sheetNumber,
          totalSheets: detail.grn.totalSheets,
          notes: detail.grn.notes,
          items: detail.items.map((item) => ({
            partId: item.partId,
            alternatePartNumber: item.alternatePartNumber,
            serialNumber: item.serialNumber,
            description: item.description,
            quantity: item.quantity,
            supplierBatchNumber: item.supplierBatchNumber,
            purchaseCostEa: item.purchaseCostEa,
            locationId: item.locationId,
            workpackId: item.workpackId,
            notes: item.notes,
          })),
        });
      });
      return;
    }
    grnService.nextNumber().then((number) => form.setValue("grnNumber", number));
  }, [grnId, form]);

  async function applyPart(index: number, partId: string) {
    const part = (parts.data ?? []).find((row) => row.id === partId);
    if (!part) return;
    const lookup = await partService.lookup(part.partNumber);
    setLookups((current) => ({ ...current, [index]: lookup }));
    form.setValue(`items.${index}.partId`, part.id);
    form.setValue(`items.${index}.description`, part.description);
    form.setValue(`items.${index}.alternatePartNumber`, lookup?.alternates.join(" / ") ?? "");
    if (lookup?.lastCost != null) form.setValue(`items.${index}.purchaseCostEa`, lookup.lastCost);
  }

  return (
    <div>
      <PageHeader title={grnId ? "Edit GRN" : "New GRN"} description="Enter the business GRN number exactly as used in Excel (GR10-11, GR259-98, etc.)." />
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            const saved = grnId ? await grnService.update(grnId, values) : await grnService.create(values, "received");
            if (file) {
              await documentService.attach({
                file,
                type: "invoice",
                entityType: "grn",
                entityId: saved.id,
                reference: saved.grnNumber,
                notes: "Attached on GRN save",
              });
            }
            toast.success(grnId ? "GRN updated" : "GRN received and stock updated");
            router.push(`/grns/${saved.id}`);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to save GRN");
          }
        })}
      >
        <Card>
          <CardHeader><CardTitle>GRN header</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Field label="GR Number" error={form.formState.errors.grnNumber?.message}><Input {...form.register("grnNumber")} /></Field>
            <Field label="Date" error={form.formState.errors.date?.message}>
              <Input type="date" value={toDateInputValue(form.watch("date"))} onChange={(e) => form.setValue("date", fromDateInputValue(e.target.value))} />
            </Field>
            <Field label="Supplier" error={form.formState.errors.supplierId?.message}>
              <SearchableSelect
                allowEmpty={false}
                value={form.watch("supplierId") || null}
                onChange={(value) => form.setValue("supplierId", value ?? "")}
                options={(suppliers.data ?? []).filter((s) => s.status === "active").map((s) => ({ value: s.id, label: s.name }))}
              />
            </Field>
            <Field label="Invoice"><Input {...form.register("invoice")} /></Field>
            <Field label="Supplier tracking reference"><Input {...form.register("supplierTrackingReference")} /></Field>
            <Field label="Supplier batch number"><Input {...form.register("supplierBatchNumber")} /></Field>
            <Field label="Workpack / job">
              <SearchableSelect
                value={form.watch("workpackId")}
                onChange={(value) => {
                  form.setValue("workpackId", value);
                  const wp = (workpacks.data ?? []).find((row) => row.id === value);
                  if (wp?.registration) form.setValue("registration", wp.registration);
                }}
                options={(workpacks.data ?? []).map((wp) => ({ value: wp.id, label: wp.workpackNumber, hint: wp.title }))}
              />
            </Field>
            <Field label="Registration"><Input {...form.register("registration")} /></Field>
            <Field label="Sheet no.">
              <div className="flex items-center gap-2">
                <Input type="number" min={1} {...form.register("sheetNumber", { valueAsNumber: true })} />
                <span className="text-sm text-muted-foreground">of</span>
                <Input type="number" min={1} {...form.register("totalSheets", { valueAsNumber: true })} />
              </div>
            </Field>
            <div className="md:col-span-3"><Field label="Notes"><Textarea {...form.register("notes")} /></Field></div>
            <Field label="Document attachment">
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>GRN items</CardTitle>
            <Button type="button" variant="outline" onClick={() => items.append({ ...emptyItem, supplierBatchNumber: form.getValues("supplierBatchNumber"), workpackId: form.getValues("workpackId") })}>
              <Plus className="h-4 w-4" /> Add item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {form.formState.errors.items?.message ? <p className="text-sm text-destructive">{form.formState.errors.items.message}</p> : null}
            {items.fields.map((field, index) => {
              const lookup = lookups[index];
              return (
                <div key={field.id} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold">Item {index + 1}</div>
                    <Button type="button" variant="ghost" onClick={() => items.remove(index)} disabled={items.fields.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-4">
                    <Field label="Part number" error={form.formState.errors.items?.[index]?.partId?.message}>
                      <SearchableSelect
                        allowEmpty={false}
                        value={form.watch(`items.${index}.partId`) || null}
                        onChange={(value) => value && applyPart(index, value)}
                        options={(parts.data ?? []).map((part) => ({
                          value: part.id,
                          label: part.partNumber,
                          hint: `${part.description} ${(alts.data ?? []).filter((a) => a.partId === part.id).map((a) => a.alternateNumber).join(" / ")}`,
                        }))}
                      />
                    </Field>
                    <Field label="Alternate P/N"><Input {...form.register(`items.${index}.alternatePartNumber`)} /></Field>
                    <Field label="Serial number"><Input {...form.register(`items.${index}.serialNumber`)} /></Field>
                    <Field label="Description" error={form.formState.errors.items?.[index]?.description?.message}><Input {...form.register(`items.${index}.description`)} /></Field>
                    <Field label="Quantity" error={form.formState.errors.items?.[index]?.quantity?.message}>
                      <Input type="number" min={0} step="1" {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} />
                    </Field>
                    <Field label="Purchase cost EA (£)" error={form.formState.errors.items?.[index]?.purchaseCostEa?.message}>
                      <Input type="number" min={0} step="0.01" {...form.register(`items.${index}.purchaseCostEa`, { valueAsNumber: true })} />
                    </Field>
                    <Field label="Supplier batch number"><Input {...form.register(`items.${index}.supplierBatchNumber`)} /></Field>
                    <Field label="Stores / location">
                      <SearchableSelect
                        value={form.watch(`items.${index}.locationId`)}
                        onChange={(value) => form.setValue(`items.${index}.locationId`, value)}
                        options={(locations.data ?? []).map((loc) => ({ value: loc.id, label: loc.name, hint: loc.code }))}
                      />
                    </Field>
                    <Field label="Workpack / job">
                      <SearchableSelect
                        value={form.watch(`items.${index}.workpackId`)}
                        onChange={(value) => form.setValue(`items.${index}.workpackId`, value)}
                        options={(workpacks.data ?? []).map((wp) => ({ value: wp.id, label: wp.workpackNumber }))}
                      />
                    </Field>
                    <div className="md:col-span-3"><Field label="Notes"><Input {...form.register(`items.${index}.notes`)} /></Field></div>
                  </div>
                  {lookup ? (
                    <div className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                      Existing part: {lookup.part.description}. Alternates: {lookup.alternates.join(", ") || "none"}. Previous cost {formatGbp(lookup.lastCost)}. Last supplier {lookup.lastSupplierName ?? "—"}. Current stock {formatNumber(lookup.currentStock)}.
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Button type="submit">{grnId ? "Save changes" : "Save GRN and receive stock"}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
