import { UsedUpPartDetail } from "@/features/aero/used-up-views";

export default async function UsedUpDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UsedUpPartDetail id={id} />;
}
