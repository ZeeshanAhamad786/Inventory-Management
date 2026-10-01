"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLiveQuery } from "@/hooks/use-live-query";
import { jobService } from "@/services/aero/jobService";
import { receiptService } from "@/services/aero/receiptService";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { NewJobModal } from "@/features/aero/new-job-modal";
import { toDateInputValue } from "@/lib/format";

export function JobsHome() {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);
  const openJobs = useLiveQuery(() => jobService.listOpenWithStats(), []);
  const jobCounts = useLiveQuery(() => jobService.counts(), []);
  const stock = useLiveQuery(() => receiptService.counts(), []);

  if (openJobs.loading || stock.loading) return <LoadingState />;
  if (openJobs.error) return <ErrorState message={openJobs.error} />;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-bold leading-none tracking-tight text-foreground">Jobs</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Every engine in the workshop right now.</p>
        </div>
        <Button
          className="h-10 rounded-lg bg-brand px-5 text-sm font-medium text-brand-foreground hover:opacity-90"
          onClick={() => setNewOpen(true)}
        >
          New job
        </Button>
      </div>

      <section className="mb-8">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Elsewhere in the workshop
        </div>
        <h2 className="mt-1 text-[20px] font-bold leading-tight text-foreground">Stores and records</h2>
        <div className="mt-3 border-t border-border" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StoreCard title="In the boxes" description="Stock sitting on the shelves" value={stock.data?.inBoxes ?? 0} href="/inventory" />
          <StoreCard title="Out with someone" description="Taken from a box, not back yet" value={stock.data?.outWithSomeone ?? 0} href="/out" />
          <StoreCard title="Completed jobs" description="Finished and filed away" value={jobCounts.data?.completed ?? 0} href="/completed" />
          <StoreCard title="History" description="Everything that has ever happened" value={jobCounts.data?.history ?? 0} href="/history" />
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-[20px] font-bold text-foreground">Jobs in progress</h2>
          <p className="text-[14px] text-muted-foreground">
            {openJobs.data?.length ?? 0} open — click a job to see its parts
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3.5">Job</th>
                  <th className="px-5 py-3.5">Engine</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Parts used</th>
                  <th className="px-5 py-3.5">Lines</th>
                  <th className="px-5 py-3.5">Started</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {(openJobs.data ?? []).map((job) => {
                  const pct = job.expectedQty > 0 ? Math.min(100, Math.round((job.usedQty / job.expectedQty) * 100)) : 0;
                  return (
                    <tr
                      key={job.id}
                      role="link"
                      tabIndex={0}
                      className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-[#eef4fb] dark:hover:bg-accent"
                      onClick={() => router.push(`/jobs/${job.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/jobs/${job.id}`);
                        }
                      }}
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-link">{job.jobNumber}</div>
                        <div className="mt-0.5 text-muted-foreground">{job.title}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-foreground">{job.engineType}</div>
                        <div className="mt-0.5 text-muted-foreground">No. {job.engineSerial}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-foreground">{job.customer}</div>
                        <div className="mt-0.5 text-muted-foreground">{job.registration}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="mb-1.5 text-foreground">
                          {job.usedQty} of {job.expectedQty}
                        </div>
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-5 py-4 tabular-nums text-foreground">{job.lineCount}</td>
                      <td className="px-5 py-4 tabular-nums text-muted-foreground">
                        {job.startDate ? toDateInputValue(job.startDate) : "—"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg border-border bg-card px-3 text-[13px] font-medium text-foreground hover:bg-muted"
                          onClick={async (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            await jobService.complete(job.id);
                            toast.success(`${job.jobNumber} marked complete`);
                          }}
                        >
                          Mark complete
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {(openJobs.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                      No open jobs. Create one with{" "}
                      <button
                        type="button"
                        className="font-medium text-link hover:underline"
                        onClick={() => setNewOpen(true)}
                      >
                        New job
                      </button>
                      .
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <NewJobModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(id) => {
          setNewOpen(false);
          router.push(`/jobs/${id}`);
        }}
      />
    </div>
  );
}

function StoreCard({
  title,
  description,
  value,
  href,
}: {
  title: string;
  description: string;
  value: number;
  href: string;
}) {
  return (
    <div className="rounded-xl border border-border border-l-[3px] border-l-brand bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{title}</div>
          <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{description}</div>
        </div>
        <div className="shrink-0 text-[28px] font-bold tabular-nums leading-none text-foreground">{value}</div>
      </div>
      <Link href={href} className="mt-4 inline-flex text-[13px] font-medium text-link hover:underline">
        Open &gt;
      </Link>
    </div>
  );
}
