import type { ParsedInvoice } from "@arbcfo/shared";

// ─── Heuristic Parser (always available, no API key needed) ───
export function parseInvoiceHeuristic(text: string): ParsedInvoice {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const fullText = text.toLowerCase();

  let vendor: string | undefined;
  let vendorAddress: string | undefined;
  let amount: number | undefined;
  let invoiceNumber: string | undefined;
  let dueDate: string | undefined;
  let currency: string | undefined = "USD";
  let memo: string | undefined;
  let confidence = 0;

  // Extract invoice number
  const invoicePatterns = [
    /invoice\s*#?\s*:?\s*([A-Z0-9\-]+)/i,
    /inv[\-\s]*(?:no|number|#)?\s*:?\s*([A-Z0-9\-]+)/i,
    /reference\s*:?\s*([A-Z0-9\-]+)/i,
  ];
  for (const pat of invoicePatterns) {
    const m = text.match(pat);
    if (m) { invoiceNumber = m[1]; confidence += 0.2; break; }
  }

  // Extract Ethereum address (0x + 40 hex chars)
  const addrMatch = text.match(/0x[a-fA-F0-9]{40}/);
  if (addrMatch) {
    vendorAddress = addrMatch[0];
    confidence += 0.15;
  }

  // Extract amount
  const amountPatterns = [
    /(?:total|amount\s*due|balance\s*due|grand\s*total)\s*:?\s*\$?([\d,]+\.?\d*)/i,
    /\$\s*([\d,]+\.\d{2})/,
    /USD\s*([\d,]+\.\d{2})/i,
    /([\d,]+\.\d{2})\s*(?:USD|USDC)/i,
  ];
  for (const pat of amountPatterns) {
    const m = text.match(pat);
    if (m) { amount = parseFloat(m[1].replace(/,/g, "")); confidence += 0.3; break; }
  }

  // Extract due date
  const datePatterns = [
    /(?:due\s*date|payment\s*due|due\s*by)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(?:due\s*date|payment\s*due|due\s*by)\s*:?\s*(\w+\s+\d{1,2},?\s*\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
  ];
  for (const pat of datePatterns) {
    const m = text.match(pat);
    if (m) { dueDate = m[1]; confidence += 0.2; break; }
  }

  // Extract vendor name
  const vendorPatterns = [/(?:from|billed?\s*by|vendor|company)\s*:?\s*(.+)/i];
  for (const pat of vendorPatterns) {
    const m = text.match(pat);
    if (m) { vendor = m[1].trim().slice(0, 100); confidence += 0.15; break; }
  }
  if (!vendor && lines.length > 0) {
    const firstLine = lines[0];
    if (firstLine.length > 2 && firstLine.length < 80 && !/^\d/.test(firstLine)) {
      vendor = firstLine;
      confidence += 0.05;
    }
  }

  // Extract memo
  const memoPatterns = [/(?:description|memo|notes|for)\s*:?\s*(.+)/i];
  for (const pat of memoPatterns) {
    const m = text.match(pat);
    if (m) { memo = m[1].trim().slice(0, 200); confidence += 0.1; break; }
  }

  // Currency
  if (fullText.includes("usdc")) currency = "USDC";
  else if (fullText.includes("eur") || fullText.includes("€")) currency = "EUR";
  else if (fullText.includes("gbp") || fullText.includes("£")) currency = "GBP";

  return {
    vendor, vendorAddress: vendorAddress as `0x${string}` | undefined,
    amount, invoiceNumber, dueDate, currency, memo,
    confidence: Math.min(confidence, 1),
  };
}

// ─── OpenAI LLM Parser ───
async function parseInvoiceOpenAI(text: string): Promise<ParsedInvoice | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a financial document parser for a Web3 treasury system. Extract invoice details and return ONLY a JSON object with these exact fields:
- vendor (string): company/vendor name
- vendorAddress (string): Ethereum wallet address (0x + 40 hex chars) if present, otherwise null
- amount (number): total amount due as a number (no currency symbols)
- invoiceNumber (string): invoice/reference number
- dueDate (string): due date in YYYY-MM-DD format, or null
- currency (string): USD, USDC, EUR, etc.
- memo (string): brief 1-line description of what the payment is for
- confidence (number 0-1): your extraction confidence
- anomalyNotes (string): any concerns about this invoice, or "none"
- suggestedCategory (string): one of "Engineering", "Marketing", "Operations", "Legal", "HR", "General"`,
          },
          {
            role: "user",
            content: `Parse this invoice:\n\n${text.slice(0, 3000)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", response.status, await response.text().catch(() => ""));
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);

    return {
      vendor: parsed.vendor || undefined,
      vendorAddress: parsed.vendorAddress || undefined,
      amount: typeof parsed.amount === "number" ? parsed.amount : parseFloat(parsed.amount) || undefined,
      invoiceNumber: parsed.invoiceNumber || undefined,
      dueDate: parsed.dueDate || undefined,
      currency: parsed.currency || "USD",
      memo: parsed.memo || parsed.anomalyNotes !== "none" ? `${parsed.memo || ""}${parsed.anomalyNotes && parsed.anomalyNotes !== "none" ? ` [AI note: ${parsed.anomalyNotes}]` : ""}`.trim() : parsed.memo,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
    };
  } catch (err) {
    console.error("OpenAI parse error:", err);
    return null;
  }
}

// ─── Anthropic LLM Parser (fallback) ───
async function parseInvoiceAnthropic(text: string): Promise<ParsedInvoice | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: `Extract invoice details from this text. Return ONLY a JSON object with these fields:
- vendor (string): company name
- vendorAddress (string): Ethereum wallet address if present, otherwise null
- amount (number): total amount due
- invoiceNumber (string): invoice/reference number
- dueDate (string): due date in YYYY-MM-DD format
- currency (string): USD, USDC, EUR, etc.
- memo (string): brief description
- confidence (number 0-1): your confidence in the extraction

Text:
${text.slice(0, 2000)}`,
          },
        ],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const content = data.content?.[0]?.text;
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as ParsedInvoice;
  } catch {
    return null;
  }
}

// ─── Combined Parser: OpenAI → Anthropic → Regex ───
export async function parseInvoice(text: string): Promise<ParsedInvoice> {
  // Try OpenAI first (user has this key)
  const openaiResult = await parseInvoiceOpenAI(text);
  if (openaiResult && (openaiResult.confidence ?? 0) > 0.5) {
    console.log("[parser] Using OpenAI result (model:", process.env.OPENAI_MODEL || "gpt-4.1", "confidence:", openaiResult.confidence, ")");
    return openaiResult;
  }

  // Try Anthropic
  const anthropicResult = await parseInvoiceAnthropic(text);
  if (anthropicResult && (anthropicResult.confidence ?? 0) > 0.5) {
    console.log("[parser] Using Anthropic result (confidence:", anthropicResult.confidence, ")");
    return anthropicResult;
  }

  // Fallback to regex
  console.log("[parser] Falling back to heuristic regex parser");
  return parseInvoiceHeuristic(text);
}
