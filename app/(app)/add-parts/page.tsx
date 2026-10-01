import { Suspense } from "react";
import { AddPartsView } from "@/features/aero/add-parts";
import { LoadingState } from "@/components/shared/states";

export default function AddPartsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AddPartsView />
    </Suspense>
  );
}
