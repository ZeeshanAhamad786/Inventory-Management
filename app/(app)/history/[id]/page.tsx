import { HistoryPartDetail } from "@/features/aero/history-views";

export default async function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HistoryPartDetail id={id} />;
}
