"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { jobService } from "@/services/aero/jobService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUkDate, toDateInputValue, fromDateInputValue, parseUkDateInput } from "@/lib/format";

const DEFAULT_START = "2026-09-17T12:00:00.000Z";

function blankForm() {
  return {
    jobNumber: "WP-132",
    startDate: DEFAULT_START,
    title: "Engine overhaul",
    engineType: "CFM56-7B26",
    engineSerial: "894412",
    registration: "G-TKLA",
    customer: "Skyline Charter",
  };
}

export function NewJobModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [dateText, setDateText] = useState(formatUkDate(DEFAULT_START));
  const datePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const next = blankForm();
    setForm(next);
    setDateText(formatUkDate(next.startDate));
  }, [open]);

  if (!open) return null;

  const fieldClass =
    "h-10 rounded-md border-border bg-card text-foreground shadow-none focus-visible:ring-brand/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[560px] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-[22px] font-bold leading-none text-foreground">New job</h2>
          <p className="mt-2 text-[14px] text-muted-foreground">A new engine coming into the workshop</p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const parsed = parseUkDateInput(dateText);
            if (!parsed) {
              toast.error("Use date format DD/MM/YYYY");
              return;
            }
            setSaving(true);
            try {
              const job = await jobService.create({
                jobNumber: form.jobNumber,
                title: form.title,
                engineType: form.engineType,
                engineSerial: form.engineSerial,
                customer: form.customer,
                registration: form.registration,
                status: "in_progress",
                notes: "",
                expectedParts: 0,
                startDate: parsed,
              });
              toast.success("Job created");
              onCreated(job.id);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Unable to create job");
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="space-y-5 px-6 py-5">
            <section>
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                The job
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ModalField label="Job number">
                  <Input
                    required
                    value={form.jobNumber}
                    onChange={(e) => setForm({ ...form, jobNumber: e.target.value })}
                    className={fieldClass}
                  />
                </ModalField>
                <ModalField label="Date started">
                  <div className="relative">
                    <Input
                      required
                      inputMode="numeric"
                      placeholder="DD/MM/YYYY"
                      value={dateText}
                      onChange={(e) => {
                        const next = e.target.value;
                        setDateText(next);
                        const parsed = parseUkDateInput(next);
                        if (parsed) setForm((prev) => ({ ...prev, startDate: parsed }));
                      }}
                      onBlur={() => {
                        const parsed = parseUkDateInput(dateText);
                        if (parsed) {
                          setForm((prev) => ({ ...prev, startDate: parsed }));
                          setDateText(formatUkDate(parsed));
                        } else if (form.startDate) {
                          setDateText(formatUkDate(form.startDate));
                        }
                      }}
                      className={`${fieldClass} pr-10`}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Pick date"
                      onClick={() => {
                        const el = datePickerRef.current;
                        if (!el) return;
                        if (typeof el.showPicker === "function") el.showPicker();
                        else el.click();
                      }}
                    >
                      <Calendar className="h-4 w-4" />
                    </button>
                    <input
                      ref={datePickerRef}
                      type="date"
                      tabIndex={-1}
                      aria-hidden
                      value={toDateInputValue(form.startDate)}
                      onChange={(e) => {
                        const iso = fromDateInputValue(e.target.value);
                        setForm((prev) => ({ ...prev, startDate: iso }));
                        setDateText(formatUkDate(iso));
                      }}
                      className="pointer-events-none absolute h-0 w-0 opacity-0"
                    />
                  </div>
                </ModalField>
              </div>
              <div className="mt-3">
                <ModalField label="Work to be done">
                  <Input
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className={fieldClass}
                  />
                </ModalField>
              </div>
            </section>

            <div className="border-t border-border" />

            <section>
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                The engine
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <ModalField label="Engine">
                  <Input
                    value={form.engineType}
                    onChange={(e) => setForm({ ...form, engineType: e.target.value })}
                    className={fieldClass}
                  />
                </ModalField>
                <ModalField label="Engine number">
                  <Input
                    value={form.engineSerial}
                    onChange={(e) => setForm({ ...form, engineSerial: e.target.value })}
                    className={fieldClass}
                  />
                </ModalField>
                <ModalField label="Registration">
                  <Input
                    value={form.registration}
                    onChange={(e) => setForm({ ...form, registration: e.target.value })}
                    className={fieldClass}
                  />
                </ModalField>
              </div>
            </section>

            <div className="border-t border-border" />

            <section>
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                The customer
              </div>
              <ModalField label="Customer name">
                <Input
                  value={form.customer}
                  onChange={(e) => setForm({ ...form, customer: e.target.value })}
                  className={fieldClass}
                />
              </ModalField>
            </section>
          </div>

          <div className="flex justify-end gap-2 border-t border-border bg-muted/60 px-6 py-4">
            <Button type="button" variant="outline" className="rounded-lg border-border bg-card text-foreground" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="rounded-lg bg-brand text-brand-foreground hover:opacity-90">
              {saving ? "Creating…" : "Create job"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
