import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <Inbox className="h-8 w-8 text-muted-foreground" />
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">{label}</div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-8 text-sm text-destructive">{message}</CardContent>
    </Card>
  );
}
