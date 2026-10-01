import { createId, nowIso } from "@/lib/utils";
import type { AeroJob, JobStatus } from "@/types/aeroswift";
import { getDb } from "@/db/aero-db";

export interface JobFormValues {
  jobNumber: string;
  title: string;
  engineType: string;
  engineSerial: string;
  customer: string;
  registration: string;
  status: JobStatus;
  notes: string;
  expectedParts?: number;
  startDate?: string | null;
}

export const jobService = {
  async list() {
    return getDb().jobs.orderBy("jobNumber").reverse().toArray();
  },

  async listOpen() {
    const all = await this.list();
    return all.filter((j) => j.status === "open" || j.status === "in_progress");
  },

  async listCompleted() {
    const all = await this.list();
    return all.filter((j) => j.status === "completed");
  },

  async get(id: string) {
    return getDb().jobs.get(id);
  },

  async create(values: JobFormValues) {
    const timestamp = nowIso();
    const job: AeroJob = {
      id: createId(),
      jobNumber: values.jobNumber.trim(),
      title: values.title.trim(),
      engineType: values.engineType.trim(),
      engineSerial: values.engineSerial.trim(),
      customer: values.customer.trim(),
      registration: values.registration.trim().toUpperCase(),
      status: values.status || "in_progress",
      notes: values.notes,
      expectedParts: values.expectedParts && values.expectedParts > 0 ? values.expectedParts : 0,
      startDate: values.startDate ?? timestamp,
      completionDate: values.status === "completed" ? timestamp : null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await getDb().jobs.add(job);
    return job;
  },

  async listOpenWithStats() {
    const [jobs, lines] = await Promise.all([this.listOpen(), getDb().receiptLines.toArray()]);
    return jobs
      .map((job) => {
        const jobLines = lines.filter((l) => l.jobId === job.id);
        const usedQty = jobLines.reduce((sum, l) => sum + (l.usedQuantity ?? 0), 0);
        const receivedQty = jobLines.reduce((sum, l) => sum + l.quantity, 0);
        const expected = job.expectedParts > 0 ? job.expectedParts : Math.max(receivedQty, 1);
        return {
          ...job,
          lineCount: jobLines.length,
          usedQty,
          expectedQty: expected,
        };
      })
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  },

  async update(id: string, values: JobFormValues) {
    const current = await this.get(id);
    if (!current) throw new Error("Job not found");
    const next: AeroJob = {
      ...current,
      ...values,
      jobNumber: values.jobNumber.trim(),
      title: values.title.trim(),
      engineType: values.engineType.trim(),
      engineSerial: values.engineSerial.trim(),
      customer: values.customer.trim(),
      registration: values.registration.trim().toUpperCase(),
      completionDate: values.status === "completed" ? current.completionDate ?? nowIso() : null,
      updatedAt: nowIso(),
    };
    await getDb().jobs.put(next);
    return next;
  },

  async complete(id: string) {
    const current = await this.get(id);
    if (!current) throw new Error("Job not found");
    const next: AeroJob = {
      ...current,
      status: "completed",
      completionDate: nowIso(),
      updatedAt: nowIso(),
    };
    await getDb().jobs.put(next);
    return next;
  },

  async reopen(id: string) {
    const current = await this.get(id);
    if (!current) throw new Error("Job not found");
    const next: AeroJob = {
      ...current,
      status: "in_progress",
      completionDate: null,
      updatedAt: nowIso(),
    };
    await getDb().jobs.put(next);
    return next;
  },

  async listCompletedWithStats() {
    const [jobs, lines] = await Promise.all([this.listCompleted(), getDb().receiptLines.toArray()]);
    return jobs
      .map((job) => {
        const jobLines = lines.filter((l) => l.jobId === job.id);
        const usedQty = jobLines.reduce((sum, l) => sum + (l.usedQuantity ?? 0), 0);
        return {
          ...job,
          lineCount: jobLines.length,
          usedQty,
        };
      })
      .sort((a, b) => (b.completionDate ?? b.updatedAt ?? "").localeCompare(a.completionDate ?? a.updatedAt ?? ""));
  },

  async counts() {
    const [jobs, lines, boxes] = await Promise.all([
      this.list(),
      getDb().receiptLines.toArray(),
      getDb().boxes.toArray(),
    ]);
    return {
      open: jobs.filter((j) => j.status !== "completed").length,
      completed: jobs.filter((j) => j.status === "completed").length,
      usedUp: lines.filter((l) => (l.usedQuantity ?? 0) > 0 && (l.usedQuantity ?? 0) >= l.quantity).length,
      history: jobs.length + lines.length + boxes.length + 3,
    };
  },
};
