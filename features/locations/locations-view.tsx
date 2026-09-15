"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { locationSchema, type LocationFormValues } from "@/schemas";
import { locationService } from "@/services/locationService";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LoadingState, ErrorState } from "@/components/shared/states";
import { useLiveQuery } from "@/hooks/use-live-query";
import { useState } from "react";

export function LocationsView() {
  const rows = useLiveQuery(() => locationService.list(), []);
  const [editing, setEditing] = useState<string | null>(null);
  if (rows.loading) return <LoadingState />;
  if (rows.error) return <ErrorState message={rows.error} />;
  return (
    <div>
      <PageHeader
        title="Stores / Locations"
        description="ASH BOX, Paint Room and other stores used on GRN items and inventory filters."
        action={
          <Dialog>
            <DialogTrigger asChild>
              <Button>New location</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New location</DialogTitle></DialogHeader>
              <LocationForm onSaved={() => toast.success("Location saved")} />
            </DialogContent>
          </Dialog>
        }
      />
      <DataTable
        data={rows.data ?? []}
        columns={[
          { id: "name", header: "Store name", accessor: (row) => row.name },
          { id: "code", header: "Code", accessor: (row) => row.code },
          { id: "description", header: "Description", accessor: (row) => row.description },
          { id: "status", header: "Status", accessor: (row) => row.status, cell: (row) => <StatusBadge value={row.status} /> },
          {
            id: "actions",
            header: "",
            cell: (row) => (
              <Button variant="outline" size="sm" onClick={() => setEditing(row.id)}>Edit</Button>
            ),
          },
        ]}
      />
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit location</DialogTitle></DialogHeader>
          {editing ? <LocationForm locationId={editing} onSaved={() => { toast.success("Location updated"); setEditing(null); }} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LocationForm({ locationId, onSaved }: { locationId?: string; onSaved: () => void }) {
  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: { name: "", code: "", description: "", status: "active" },
  });
  useEffect(() => {
    if (!locationId) return;
    locationService.get(locationId).then((row) => row && form.reset(row));
  }, [locationId, form]);
  return (
    <form
      className="grid gap-3"
      onSubmit={form.handleSubmit(async (values) => {
        if (locationId) await locationService.update(locationId, values);
        else await locationService.create(values);
        onSaved();
      })}
    >
      <Field label="Store name" error={form.formState.errors.name?.message}><Input {...form.register("name")} /></Field>
      <Field label="Location code" error={form.formState.errors.code?.message}><Input {...form.register("code")} /></Field>
      <Field label="Description"><Textarea {...form.register("description")} /></Field>
      <Field label="Status">
        <select className="h-9 w-full rounded-md border bg-card px-3 text-sm" {...form.register("status")}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </Field>
      <Button type="submit">Save location</Button>
    </form>
  );
}
