"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { documentService } from "@/services/documentService";
import { useLiveQuery } from "@/hooks/use-live-query";
import { formatUkDateTime } from "@/lib/format";
import { LoadingState, ErrorState } from "@/components/shared/states";
import type { DocumentType, EntityType } from "@/types";

export function DocumentsView() {
  const docs = useLiveQuery(() => documentService.list(), []);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<DocumentType>("invoice");
  const [entityType, setEntityType] = useState<EntityType>("grn");
  const [reference, setReference] = useState("");
  if (docs.loading) return <LoadingState />;
  if (docs.error) return <ErrorState message={docs.error} />;
  return (
    <div>
      <PageHeader title="Documents" description="Attachment metadata is stored independently of local file paths so this can later move to Supabase Storage." />
      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-6 md:grid-cols-4">
          <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <select className="h-9 rounded-md border bg-card px-3 text-sm" value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
            <option value="invoice">Invoice</option>
            <option value="delivery_note">Delivery note</option>
            <option value="certificate">Certificate</option>
            <option value="photo">Photo</option>
            <option value="other">Other</option>
          </select>
          <select className="h-9 rounded-md border bg-card px-3 text-sm" value={entityType} onChange={(e) => setEntityType(e.target.value as EntityType)}>
            <option value="grn">GRN</option>
            <option value="part">Part</option>
            <option value="workpack">Workpack</option>
            <option value="supplier">Supplier</option>
          </select>
          <Input placeholder="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
          <Button onClick={async () => {
            if (!file) { toast.error("Choose a file first"); return; }
            await documentService.attach({ file, type, entityType, entityId: reference || "unassigned", reference, notes: "" });
            toast.success("Document attached");
            setFile(null);
          }}>Upload</Button>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {(docs.data ?? []).map((doc) => (
          <div key={doc.id} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm">
            <div>
              <div className="font-medium">{doc.fileName}</div>
              <div className="text-xs text-muted-foreground">{doc.type} · {doc.entityType} · {doc.reference} · {formatUkDateTime(doc.createdAt)}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => documentService.download(doc.id)}>Download</Button>
              <Button variant="destructive" size="sm" onClick={() => documentService.archive(doc.id)}>Remove</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
