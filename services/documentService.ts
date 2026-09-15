import { getDb } from "@/db/db";
import { createId, nowIso } from "@/lib/utils";
import type { DocumentRecord, DocumentType, EntityType } from "@/types";
import { activityService } from "./activityService";
import { getServiceUser } from "./sessionContext";

export const documentService = {
  async list() {
    return getDb().documents.orderBy("createdAt").reverse().toArray();
  },

  async listFor(entityType: EntityType, entityId: string) {
    return (await getDb().documents.toArray()).filter(
      (doc) => doc.entityType === entityType && doc.entityId === entityId,
    );
  },

  async get(id: string) {
    return getDb().documents.get(id);
  },

  async attach(input: {
    file: File;
    type: DocumentType;
    entityType: EntityType;
    entityId: string;
    reference: string;
    notes: string;
  }) {
    const user = getServiceUser();
    const record: DocumentRecord = {
      id: createId(),
      fileName: input.file.name,
      mimeType: input.file.type || "application/octet-stream",
      size: input.file.size,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      reference: input.reference,
      notes: input.notes,
      data: input.file,
      createdBy: user.id,
      createdAt: nowIso(),
    };
    await getDb().documents.add(record);
    await activityService.log({
      action: "created",
      entityType: "document",
      entityId: record.id,
      reference: record.fileName,
      description: `Attached ${record.fileName} to ${input.entityType} ${input.reference}`,
    });
    return record;
  },

  async archive(id: string) {
    const doc = await this.get(id);
    if (!doc) throw new Error("Document not found");
    await getDb().documents.delete(id);
    await activityService.log({
      action: "archived",
      entityType: "document",
      entityId: id,
      reference: doc.fileName,
      description: `Removed document ${doc.fileName}`,
    });
  },

  async download(id: string) {
    const doc = await this.get(id);
    if (!doc?.data) throw new Error("No file data stored for this document");
    const blob = doc.data instanceof Blob ? doc.data : new Blob([doc.data], { type: doc.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = doc.fileName;
    link.click();
    URL.revokeObjectURL(url);
  },
};
