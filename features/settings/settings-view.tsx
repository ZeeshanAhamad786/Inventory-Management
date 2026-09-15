"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { settingsSchema, type SettingsFormValues } from "@/schemas";
import { settingsService } from "@/services/settingsService";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { useLiveQuery } from "@/hooks/use-live-query";
import { LoadingState } from "@/components/shared/states";

export function SettingsView() {
  const settings = useLiveQuery(() => settingsService.get(), []);
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      companyName: "",
      companyAddress: "",
      companyPhone: "",
      companyEmail: "",
      grnPrefix: "GR",
      autoGrnNumber: true,
      nextGrnSequence: 1,
    },
  });

  useEffect(() => {
    if (settings.data) form.reset(settings.data);
  }, [settings.data, form]);

  if (settings.loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Settings" description="Company details, GRN numbering and demo data controls." />
      <Card className="mb-4">
        <CardHeader><CardTitle>Company</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Field label="Company name" error={form.formState.errors.companyName?.message}><Input {...form.register("companyName")} /></Field>
          <Field label="Email"><Input {...form.register("companyEmail")} /></Field>
          <div className="md:col-span-2"><Field label="Address"><Input {...form.register("companyAddress")} /></Field></div>
          <Field label="Phone"><Input {...form.register("companyPhone")} /></Field>
          <Field label="GRN prefix"><Input {...form.register("grnPrefix")} /></Field>
          <Field label="Next GRN sequence"><Input type="number" {...form.register("nextGrnSequence", { valueAsNumber: true })} /></Field>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.watch("autoGrnNumber")} onCheckedChange={(value) => form.setValue("autoGrnNumber", value)} />
            Automatic GRN sequence (still editable on each GRN)
          </label>
          <div className="md:col-span-2">
            <Button onClick={form.handleSubmit(async (values) => {
              await settingsService.update(values);
              toast.success("Settings saved");
            })}>Save settings</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Reset demo data</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>This permanently replaces all local IndexedDB records with the original aviation demo dataset. It does not run unless you confirm.</p>
          <ConfirmButton
            title="Reset all demo data?"
            description="All GRNs, stock movements, costings and documents in this browser will be replaced with the seeded demo."
            onConfirm={async () => {
              await settingsService.resetDemoData();
              toast.success("Demo data reset. Refresh if screens look stale.");
              window.location.reload();
            }}
          >
            Reset demo data
          </ConfirmButton>
        </CardContent>
      </Card>
    </div>
  );
}
