"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { supplierSchema, type SupplierFormValues } from "@/schemas";
import { supplierService } from "@/services/supplierService";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function SupplierForm({ supplierId }: { supplierId?: string }) {
  const router = useRouter();
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { name: "", contactPerson: "", email: "", phone: "", address: "", notes: "", status: "active" },
  });

  useEffect(() => {
    if (!supplierId) return;
    supplierService.get(supplierId).then((supplier) => {
      if (!supplier) return;
      form.reset(supplier);
    });
  }, [supplierId, form]);

  return (
    <div>
      <PageHeader title={supplierId ? "Edit supplier" : "New supplier"} />
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <Field label="Name" error={form.formState.errors.name?.message}><Input {...form.register("name")} /></Field>
          <Field label="Contact person"><Input {...form.register("contactPerson")} /></Field>
          <Field label="Email" error={form.formState.errors.email?.message}><Input {...form.register("email")} /></Field>
          <Field label="Phone"><Input {...form.register("phone")} /></Field>
          <div className="md:col-span-2"><Field label="Address"><Input {...form.register("address")} /></Field></div>
          <div className="md:col-span-2"><Field label="Notes"><Textarea {...form.register("notes")} /></Field></div>
          <Field label="Status">
            <select className="h-9 w-full rounded-md border bg-card px-3 text-sm" {...form.register("status")}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <div className="md:col-span-2 flex gap-2">
            <Button onClick={form.handleSubmit(async (values) => {
              try {
                const saved = supplierId ? await supplierService.update(supplierId, values) : await supplierService.create(values);
                toast.success("Supplier saved");
                router.push(`/suppliers/${saved.id}`);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to save supplier");
              }
            })}>Save</Button>
            <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
