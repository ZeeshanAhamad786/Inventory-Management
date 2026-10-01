import { NextResponse } from "next/server";
import { extractWithAzure, isAzureOcrConfigured } from "@/services/aero/azureOcr";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function GET() {
  return NextResponse.json({
    configured: isAzureOcrConfigured(),
    engine: isAzureOcrConfigured() ? "azure" : "tesseract-fallback",
    regionHint: "Prefer Azure resource in UK South for UK company data residency.",
  });
}

export async function POST(request: Request) {
  try {
    if (!isAzureOcrConfigured()) {
      return NextResponse.json(
        {
          fallback: true,
          message: "Azure Document Intelligence is not configured. Using on-device OCR.",
        },
        { status: 503 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 8MB). Use a clearer single-page photo." }, { status: 400 });
    }

    const type = (file.type || "application/octet-stream").toLowerCase();
    const allowed = type.startsWith("image/") || type.includes("pdf");
    if (!allowed) {
      return NextResponse.json({ error: "Upload a JPG, PNG, or PDF invoice/certificate." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const result = await extractWithAzure(bytes, type);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[ocr/extract]", error);
    return NextResponse.json(
      {
        fallback: true,
        error: error instanceof Error ? error.message : "OCR failed",
      },
      { status: 502 },
    );
  }
}
