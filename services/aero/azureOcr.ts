import type { OcrExtractResult } from "@/types/aeroswift";
import { parseInvoiceText } from "@/services/aero/ocrService";

type AzureAnalyzeResult = {
  status?: string;
  analyzeResult?: {
    content?: string;
    documents?: Array<{
      fields?: Record<string, AzureField | undefined>;
    }>;
  };
  error?: { message?: string };
};

type AzureField = {
  type?: string;
  content?: string;
  valueString?: string;
  valueDate?: string;
  valueNumber?: number;
  valueCurrency?: { amount?: number; currencyCode?: string };
  valueAddress?: { streetAddress?: string; city?: string; countryRegion?: string };
  valueArray?: Array<{ type?: string; valueObject?: Record<string, AzureField | undefined> }>;
  confidence?: number;
};

function fieldText(field?: AzureField): string {
  if (!field) return "";
  return (field.valueString || field.content || "").trim();
}

function fieldDate(field?: AzureField): string {
  if (!field) return "";
  if (field.valueDate) {
    // Azure returns YYYY-MM-DD → convert to DD/MM/YYYY for UK form
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(field.valueDate);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return field.valueDate;
  }
  return fieldText(field);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function azureConfigured() {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.replace(/\/$/, "");
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  return Boolean(endpoint && key);
}

/**
 * Azure Document Intelligence (prebuilt-invoice) — UK-friendly production OCR.
 * Requires AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT + AZURE_DOCUMENT_INTELLIGENCE_KEY.
 */
export async function extractWithAzure(bytes: ArrayBuffer, contentType: string): Promise<OcrExtractResult> {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.replace(/\/$/, "");
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  if (!endpoint || !key) {
    throw new Error("Azure Document Intelligence is not configured");
  }

  const apiVersion = process.env.AZURE_DOCUMENT_INTELLIGENCE_API_VERSION || "2024-11-30";
  const model = process.env.AZURE_DOCUMENT_INTELLIGENCE_MODEL || "prebuilt-invoice";
  const analyzeUrl = `${endpoint}/documentintelligence/documentModels/${model}:analyze?api-version=${apiVersion}`;

  const start = await fetch(analyzeUrl, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": contentType || "application/octet-stream",
    },
    body: bytes,
  });

  if (!start.ok) {
    const errText = await start.text().catch(() => "");
    throw new Error(`Azure analyze failed (${start.status}): ${errText.slice(0, 240)}`);
  }

  const operationUrl = start.headers.get("operation-location") || start.headers.get("Operation-Location");
  if (!operationUrl) {
    throw new Error("Azure did not return an operation-location to poll");
  }

  let payload: AzureAnalyzeResult | null = null;
  for (let i = 0; i < 30; i += 1) {
    await sleep(i === 0 ? 800 : 1200);
    const poll = await fetch(operationUrl, {
      headers: { "Ocp-Apim-Subscription-Key": key },
    });
    payload = (await poll.json()) as AzureAnalyzeResult;
    if (payload.status === "succeeded") break;
    if (payload.status === "failed") {
      throw new Error(payload.error?.message || "Azure document analysis failed");
    }
  }

  if (!payload || payload.status !== "succeeded") {
    throw new Error("Azure document analysis timed out — try a clearer photo");
  }

  const content = payload.analyzeResult?.content || "";
  const doc = payload.analyzeResult?.documents?.[0];
  const fields = doc?.fields ?? {};

  // Start from aviation packing-list / part heuristics (works for Superior CoC sheets too)
  const parsed = parseInvoiceText(content);
  parsed.engine = "azure";
  parsed.rawText = content || parsed.rawText;
  const heuristicLines = parsed.lines;

  const vendorName = fieldText(fields.VendorName) || fieldText(fields.MerchantName);
  const invoiceId = fieldText(fields.InvoiceId) || fieldText(fields.InvoiceNumber);
  const invoiceDate = fieldDate(fields.InvoiceDate) || fieldDate(fields.DueDate);
  const purchaseOrder = fieldText(fields.PurchaseOrder);
  const customerName = fieldText(fields.CustomerName);

  // Prefer CoC / packing-list manufacturer over Sold-to customer when heuristics found it
  if (vendorName && !parsed.supplierName.includes("Superior")) parsed.supplierName = vendorName;
  else if (vendorName && !parsed.supplierName) parsed.supplierName = vendorName;
  if (invoiceId) parsed.invoiceReference = invoiceId;
  if (invoiceDate) parsed.date = invoiceDate;
  if (purchaseOrder) {
    parsed.salesOrder = parsed.salesOrder || purchaseOrder;
    parsed.customerOrder = parsed.customerOrder || purchaseOrder;
  }
  if (customerName && !parsed.customerOrder) parsed.customerOrder = customerName;

  // Line items from Azure invoice model
  const items = fields.Items?.valueArray ?? [];
  if (items.length) {
    const azureLines = items.map((item, index) => {
      const obj = item.valueObject ?? {};
      const description = fieldText(obj.Description) || fieldText(obj.ProductCode) || `Line ${index + 1}`;
      const productCode = fieldText(obj.ProductCode);
      const qty = obj.Quantity?.valueNumber ?? (Number(fieldText(obj.Quantity)) || 1);
      const unit = fieldText(obj.Unit) || "EA";
      const fromDesc = parseInvoiceText(`${productCode} ${description}`);
      const partNumber = productCode || fromDesc.lines[0]?.partNumber || "";
      return {
        partNumber,
        description,
        quantity: qty > 0 ? qty : 1,
        unit: unit.toUpperCase().startsWith("EA") ? "EA" : unit,
        batchNumber: fromDesc.lines[0]?.batchNumber ?? "",
        serialNumbers: fromDesc.lines[0]?.serialNumbers ?? "",
        expiryDate: "",
        condition: fromDesc.lines[0]?.condition ?? ("NEW" as const),
        origin: fromDesc.lines[0]?.origin ?? "",
        weightKg: null,
        confidence: Math.min(0.95, (item as AzureField).confidence ?? 0.85),
      };
    });

    const azureUseful = azureLines.filter((l) => l.partNumber || l.description.length > 3);
    const heuristicScore = heuristicLines.filter((l) => l.batchNumber || /^S[AL]/i.test(l.partNumber)).length;
    const azureScore = azureUseful.filter((l) => l.partNumber).length;

    // Packing lists often have weak Azure Items — keep aviation heuristic lines when richer
    if (azureUseful.length && azureScore >= heuristicScore && azureScore > 0) {
      parsed.lines = azureUseful;
    } else if (heuristicLines.length) {
      parsed.lines = heuristicLines;
    } else {
      parsed.lines = azureUseful;
    }
  }

  // GRN on document body
  const grMatch = content.match(/\bGRN?\s*[:#-]?\s*(GR)?(\d{3,6})\b/i);
  if (grMatch) {
    parsed.grNumber = `GR${grMatch[2]}`;
  }

  // Certificate / Form 1 style refs often appear as free text
  if (!parsed.certificateNumber) {
    const cert =
      content.match(/\b(?:Certificate|Cert(?:ificate)?\s*(?:No|Ref(?:erence)?)?|EASA\s*Form\s*1)[:\s#-]*([A-Z0-9/-]{5,})\b/i)?.[1] ??
      "";
    if (cert) parsed.certificateNumber = cert;
  }

  parsed.warnings = parsed.warnings.filter((w) => !w.includes("not detected") || !parsed.supplierName);
  if (!parsed.supplierName) parsed.warnings.push("Supplier not found — check Vendor name on the invoice.");
  if (!parsed.lines.length) parsed.warnings.push("No line items found — enter the part manually.");
  parsed.warnings.unshift("Read by Azure Document Intelligence (UK-ready). Review every line — each becomes its own GRN.");
  if (parsed.lines.length > 1) {
    parsed.warnings.unshift(`${parsed.lines.length} product lines found — confirm details, then create ${parsed.lines.length} GRNs.`);
  }

  return parsed;
}

export function isAzureOcrConfigured() {
  return azureConfigured();
}
