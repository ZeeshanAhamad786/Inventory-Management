"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { pricingRuleSchema, type PricingRuleFormValues } from "@/schemas";
import { pricingService } from "@/services/pricingService";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState, ErrorState } from "@/components/shared/states";
import { useLiveQuery } from "@/hooks/use-live-query";
import { formatGbp } from "@/lib/format";

export function PricingRulesView() {
  const rules = useLiveQuery(() => pricingService.list(), []);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  if (rules.loading) return <LoadingState />;
  if (rules.error) return <ErrorState message={rules.error} />;
  return (
    <div>
      <PageHeader
        title="Pricing rules"
        description="Tiered sale pricing. The engine selects the matching cost band. POA is used when no numeric multiplier applies."
        action={<Button onClick={() => setEditing("new")}>New rule</Button>}
      />
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Priority</th>
              <th className="p-3 text-left">Label</th>
              <th className="p-3 text-left">Min cost</th>
              <th className="p-3 text-left">Max cost</th>
              <th className="p-3 text-left">Multiplier</th>
              <th className="p-3 text-left">Active</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(rules.data ?? []).map((rule) => (
              <tr key={rule.id} className="border-t">
                <td className="p-3">{rule.priority}</td>
                <td className="p-3">{rule.label} {rule.isPoa ? <StatusBadge value="POA" /> : null}</td>
                <td className="p-3">{formatGbp(rule.minCost)}</td>
                <td className="p-3">{rule.maxCost === null ? "∞" : formatGbp(rule.maxCost)}</td>
                <td className="p-3">{rule.multiplier ?? "POA"}</td>
                <td className="p-3">{rule.active ? "Yes" : "No"}</td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => setEditing(rule.id)}>Edit</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing === "new" ? "New pricing rule" : "Edit pricing rule"}</DialogTitle></DialogHeader>
          {editing ? (
            <RuleForm
              ruleId={editing === "new" ? undefined : editing}
              initial={editing === "new" ? undefined : (rules.data ?? []).find((r) => r.id === editing)}
              onSaved={() => { toast.success("Pricing rule saved"); setEditing(null); }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RuleForm({
  ruleId,
  initial,
  onSaved,
}: {
  ruleId?: string;
  initial?: PricingRuleFormValues;
  onSaved: () => void;
}) {
  const form = useForm<PricingRuleFormValues>({
    resolver: zodResolver(pricingRuleSchema),
    defaultValues: initial ?? {
      label: "",
      minCost: 0,
      maxCost: 1,
      multiplier: 3,
      isPoa: false,
      active: true,
      priority: 1,
    },
  });
  const isPoa = form.watch("isPoa");
  return (
    <form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => {
      if (ruleId) await pricingService.update(ruleId, values);
      else await pricingService.create(values);
      onSaved();
    })}>
      <Field label="Label" error={form.formState.errors.label?.message}><Input {...form.register("label")} /></Field>
      <Field label="Min cost"><Input type="number" step="0.01" {...form.register("minCost", { valueAsNumber: true })} /></Field>
      <Field label="Max cost (blank = none)">
        <Input type="number" step="0.01" value={form.watch("maxCost") ?? ""} onChange={(e) => form.setValue("maxCost", e.target.value === "" ? null : Number(e.target.value))} />
      </Field>
      <Field label="Multiplier">
        <Input type="number" step="0.01" disabled={isPoa} {...form.register("multiplier", { valueAsNumber: true })} />
      </Field>
      <label className="flex items-center gap-2 text-sm"><Switch checked={isPoa} onCheckedChange={(value) => form.setValue("isPoa", value)} /> POA band</label>
      <label className="flex items-center gap-2 text-sm"><Switch checked={form.watch("active")} onCheckedChange={(value) => form.setValue("active", value)} /> Active</label>
      <Field label="Priority"><Input type="number" {...form.register("priority", { valueAsNumber: true })} /></Field>
      <div className="flex gap-2">
        <Button type="submit">Save</Button>
        {ruleId ? (
          <ConfirmButton title="Remove rule?" description="This pricing rule will be removed from the engine." onConfirm={async () => { await pricingService.remove(ruleId); onSaved(); }}>
            Remove
          </ConfirmButton>
        ) : null}
      </div>
    </form>
  );
}
