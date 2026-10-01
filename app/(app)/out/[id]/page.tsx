import { OutPartDetail } from "@/features/aero/out-views";

export default async function OutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OutPartDetail id={id} />;
}
