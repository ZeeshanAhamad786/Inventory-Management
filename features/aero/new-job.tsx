"use client";

import { NewJobModal } from "@/features/aero/new-job-modal";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** /jobs/new opens the same modal over Jobs for deep links */
export function NewJobForm() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-[50vh]">
      <NewJobModal
        open={open}
        onClose={() => {
          setOpen(false);
          router.push("/jobs");
        }}
        onCreated={(id) => router.push(`/jobs/${id}`)}
      />
    </div>
  );
}
