"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { workpackSchema, type WorkpackFormValues } from "@/schemas";
import { workpackService } from "@/services/workpackService";
import { PageHeader, PageHeaderLink } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/shared/states";
import { useLiveQuery } from "@/hooks/use-live-query";
import { formatGbp, formatGbpOrPoa, formatNumber, formatUkDate, toDateInputValue } from "@/lib/format";
import { getDb } from "@/db/db";

export function WorkpacksList() {
  const router = useRouter();
  const rows = useLiveQuery(() => workpackService.list(), []);
  if (rows.loading) return <LoadingState />;
  if (rows.error) return <ErrorState message={rows.error} />;
  return (
    <div>
      <PageHeader title="Workpacks / Jobs" description="Answer questions such as: what parts are associated with Job 123?" action={<PageHeaderLink href="/workpacks/new">New workpack</PageHeaderLink>} />
      <DataTable
        data={rows.data ?? []}
        onRowClick={(row) => router.push(`/workpacks/${row.id}`)}
        columns={[
          { id: "workpackNumber", header: "Workpack", accessor: (row) => row.workpackNumber },
          { id: "title", header: "Title", accessor: (row) => row.title },
          { id: "registration", header: "Reg", accessor: (row) => row.registration },
          { id: "status", header: "Status", accessor: (row) => row.status, cell: (row) => <StatusBadge value={row.status} /> },
        ]}
      />
    </div>
  );
}

export function WorkpackForm({ workpackId }: { workpackId?: string }) {
  const router = useRouter();
  const form = useForm<WorkpackFormValues>({
    resolver: zodResolver(workpackSchema),
    defaultValues: { workpackNumber: "", title: "", registration: "", status: "open", startDate: null, completionDate: null, notes: "" },
  });
  useEffect(() => {
    if (!workpackId) return;
    workpackService.get(workpackId).then((row) => {
      if (!row) return;
      form.reset({ ...row, startDate: row.startDate, completionDate: row.completionDate });
    });
  }, [workpackId, form]);
  return (
    <div>
      <PageHeader title={workpackId ? "Edit workpack" : "New workpack"} />
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <Field label="Workpack number" error={form.formState.errors.workpackNumber?.message}><Input {...form.register("workpackNumber")} /></Field>
          <Field label="Title" error={form.formState.errors.title?.message}><Input {...form.register("title")} /></Field>
          <Field label="Registration"><Input {...form.register("registration")} placeholder="G-ICRM" /></Field>
          <Field label="Status">
            <select className="h-9 w-full rounded-md border bg-card px-3 text-sm" {...form.register("status")}>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <Field label="Start date">
            <Input type="date" value={toDateInputValue(form.watch("startDate"))} onChange={(e) => form.setValue("startDate", e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null)} />
          </Field>
          <Field label="Completion date">
            <Input type="date" value={toDateInputValue(form.watch("completionDate"))} onChange={(e) => form.setValue("completionDate", e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null)} />
          </Field>
          <div className="md:col-span-2"><Field label="Notes"><Textarea {...form.register("notes")} /></Field></div>
          <div className="md:col-span-2 flex gap-2">
            <Button onClick={form.handleSubmit(async (values) => {
              try {
                const saved = workpackId ? await workpackService.update(workpackId, values) : await workpackService.create(values);
                toast.success("Workpack saved");
                router.push(`/workpacks/${saved.id}`);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to save workpack");
              }
            })}>Save</Button>
            <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function WorkpackDetail({ id }: { id: string }) {
  const detail = useLiveQuery(() => workpackService.getDetail(id), [id]);
  const parts = useLiveQuery(() => getDb().parts.toArray(), []);
  if (detail.loading) return <LoadingState />;
  if (!detail.data) return <ErrorState message="Workpack not found" />;
  const { workpack, items, grns, movements, totals, receivedQty, issuedQty } = detail.data;
  return (
    <div>
      <PageHeader title={workpack.workpackNumber} description={`${workpack.title} · ${workpack.registration || "No registration"}`} action={<PageHeaderLink href={`/workpacks/${id}/edit`}>Edit</PageHeaderLink>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Received qty" value={formatNumber(receivedQty)} />
        <Stat label="Issued qty" value={formatNumber(issuedQty)} />
        <Stat label="Cost" value={formatGbp(totals.totalCost)} />
        <Stat label="Profit" value={formatGbpOrPoa(totals.profit, totals.profit === null)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Parts associated</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {items.map((item) => {
              const part = (parts.data ?? []).find((row) => row.id === item.partId);
              return (
                <div key={item.id} className="flex justify-between rounded-md border px-3 py-2">
                  <Link href={`/parts/${item.partId}`} className="font-medium hover:underline">{part?.partNumber}</Link>
                  <span>qty {item.quantity} · {formatGbp(item.quantity * item.purchaseCostEa)}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>GRNs</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {grns.map((grn) => (
              <Link key={grn!.id} href={`/grns/${grn!.id}`} className="flex justify-between rounded-md border px-3 py-2">
                <span>{grn!.grnNumber}</span>
                <span>{formatUkDate(grn!.date)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Stock movements</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {movements.map((movement) => (
              <div key={movement.id} className="flex justify-between">
                <span>{formatUkDate(movement.date)} · {movement.type}</span>
                <span>{movement.quantityChange}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
