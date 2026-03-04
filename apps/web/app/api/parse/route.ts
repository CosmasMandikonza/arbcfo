import { NextRequest, NextResponse } from "next/server";
import { parseInvoice } from "@/lib/invoice-parser";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let text = "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      text = body.text || "";
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const rawText = formData.get("text") as string | null;

      if (rawText) {
        text = rawText;
      } else if (file) {
        // Read file as text (for plain text/CSV invoices)
        // PDF extraction should happen client-side with pdfjs
        text = await file.text();
      }
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: "No invoice text provided" },
        { status: 400 }
      );
    }

    const result = parseInvoice(text);

    return NextResponse.json({ parsed: result });
  } catch (err) {
    console.error("Parse error:", err);
    return NextResponse.json(
      { error: "Failed to parse invoice" },
      { status: 500 }
    );
  }
}
