"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { partSchema, type PartFormValues } from "@/schemas";
import { partService } from "@/services/partService";
import { PART_CATEGORIES, UNITS_OF_MEASURE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/field";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export function PartForm({ partId }: { partId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(Boolean(partId));
  const form = useForm<PartFormValues>({
    resolver: zodResolver(partSchema),
    defaultValues: {
      partNumber: "",
      description: "",
      category: "Fasteners",
      unitOfMeasure: "EA",
      defaultCost: null,
      defaultSalePrice: null,
      status: "active",
      notes: "",
      alternateNumbers: [],
    },
  });
  const alternates = form.watch("alternateNumbers");

  useEffect(() => {
    if (!partId) return;
    Promise.all([partService.get(partId), partService.getAlternates(partId)]).then(([part, alts]) => {
      if (!part) {
        toast.error("Part not found");
        router.push("/parts");
        return;
      }
      form.reset({
        partNumber: part.partNumber,
        description: part.description,
        category: part.category,
        unitOfMeasure: part.unitOfMeasure,
        defaultCost: part.defaultCost,
        defaultSalePrice: part.defaultSalePrice,
        status: part.status,
        notes: part.notes,
        alternateNumbers: alts.map((item) => item.alternateNumber),
      });
      setLoading(false);
    });
  }, [partId, form, router]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading part…</p>;

  return (
    <div>
      <PageHeader title={partId ? "Edit part" : "New part"} description="Primary P/N plus optional alternate numbers. Alternates are search aliases, not separate stock items." />
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <Field label="Part number" error={form.formState.errors.partNumber?.message}>
            <Input {...form.register("partNumber")} />
          </Field>
          <Field label="Description" error={form.formState.errors.description?.message}>
            <Input {...form.register("description")} />
          </Field>
          <Field label="Category">
            <select className="h-9 w-full rounded-md border bg-card px-3 text-sm" {...form.register("category")}>
              {PART_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </Field>
          <Field label="Unit of measure">
            <select className="h-9 w-full rounded-md border bg-card px-3 text-sm" {...form.register("unitOfMeasure")}>
              {UNITS_OF_MEASURE.map((unit) => (
                <option key={unit}>{unit}</option>
              ))}
            </select>
          </Field>
          <Field label="Default cost (£)">
            <Input
              type="number"
              step="0.01"
              min="0"
              onChange={(event) => form.setValue("defaultCost", event.target.value === "" ? null : Number(event.target.value))}
              value={form.watch("defaultCost") ?? ""}
            />
          </Field>
          <Field label="Default sale price (£)">
            <Input
              type="number"
              step="0.01"
              min="0"
              onChange={(event) =>
                form.setValue("defaultSalePrice", event.target.value === "" ? null : Number(event.target.value))
              }
              value={form.watch("defaultSalePrice") ?? ""}
            />
          </Field>
          <Field label="Status">
            <select className="h-9 w-full rounded-md border bg-card px-3 text-sm" {...form.register("status")}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Alternate part numbers">
              <div className="space-y-2">
                {alternates.map((value, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={value}
                      onChange={(event) => {
                        const next = [...alternates];
                        next[index] = event.target.value;
                        form.setValue("alternateNumbers", next);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => form.setValue("alternateNumbers", alternates.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => form.setValue("alternateNumbers", [...alternates, ""])}>
                  Add alternate P/N
                </Button>
              </div>
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Notes">
              <Textarea {...form.register("notes")} />
            </Field>
          </div>
          <div className="md:col-span-2 flex gap-2">
            <Button
              onClick={form.handleSubmit(async (values) => {
                try {
                  const saved = partId ? await partService.update(partId, values) : await partService.create(values);
                  toast.success(partId ? "Part updated" : "Part created");
                  router.push(`/parts/${saved.id}`);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Unable to save part");
                }
              })}
            >
              Save part
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
