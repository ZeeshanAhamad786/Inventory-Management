import { InventoryPartDetail } from "@/features/aero/inventory-views";

export default async function InventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InventoryPartDetail id={id} />;
}
