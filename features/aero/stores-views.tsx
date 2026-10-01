"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLiveQuery } from "@/hooks/use-live-query";
import { jobService } from "@/services/aero/jobService";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { toDateInputValue } from "@/lib/format";

export { InventoryView } from "@/features/aero/inventory-views";

export { OutWithSomeoneView } from "@/features/aero/out-views";

export function CompletedJobsView() {
  const router = useRouter();
  const jobs = useLiveQuery(() => jobService.listCompletedWithStats(), []);

  if (jobs.loading) return <LoadingState />;
  if (jobs.error) return <ErrorState message={jobs.error} />;

  const rows = jobs.data ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-[32px] font-bold leading-none tracking-tight text-foreground">Completed jobs</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Engines that have left the workshop. Open one to see what went into it.
        </p>
      </div>

      <div className="mb-3 border-t border-border pt-4">
        <div className="text-[15px] font-semibold text-foreground">Filed</div>
        <div className="mt-0.5 text-[14px] text-muted-foreground">
          {rows.length} {rows.length === 1 ? "job" : "jobs"}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3.5">Job</th>
                <th className="px-5 py-3.5">Engine</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5 text-center">Lines</th>
                <th className="px-5 py-3.5 text-center">Items used</th>
                <th className="px-5 py-3.5">Started</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((job) => (
                <tr
                  key={job.id}
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
                    <div className="font-semibold text-link underline-offset-2 hover:underline">{job.jobNumber}</div>
                    <div className="mt-0.5 text-muted-foreground">{job.title}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-medium text-foreground">{job.engineType}</div>
                    <div className="mt-0.5 text-muted-foreground">Engine no. {job.engineSerial}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-medium text-foreground">{job.customer}</div>
                    <div className="mt-0.5 text-muted-foreground">{job.registration}</div>
                  </td>
                  <td className="px-5 py-4 text-center tabular-nums text-foreground">{job.lineCount}</td>
                  <td className="px-5 py-4 text-center tabular-nums text-foreground">{job.usedQty}</td>
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
                        await jobService.reopen(job.id);
                        toast.success(`${job.jobNumber} reopened`);
                        router.push(`/jobs/${job.id}`);
                      }}
                    >
                      Reopen
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                    No completed jobs yet. Mark a job complete from the Jobs list or job detail.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
