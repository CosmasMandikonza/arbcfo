import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const category = searchParams.get("category");

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { vendorName: { contains: search } },
      { receiptId: { contains: search } },
      { vendor: { contains: search } },
    ];
  }

  if (category && Number(category) >= 0) {
    where.categoryId = Number(category);
  }

  const receipts = await prisma.receipt.findMany({
    where,
    orderBy: { executedAt: "desc" },
  });

  return NextResponse.json({ receipts });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    receiptId,
    intentId,
    vendor,
    vendorName,
    token,
    amount,
    amountFormatted,
    categoryId,
    invoiceHash,
    memoHash,
    txHash,
    executedAt,
  } = body;

  if (!receiptId || intentId === undefined || !vendor || !token || !amount || !invoiceHash) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: receiptId, intentId, vendor, token, amount, invoiceHash",
      },
      { status: 400 }
    );
  }

  let executedAtTs = Math.floor(Date.now() / 1000);
  if (typeof executedAt === "number") {
    executedAtTs = executedAt > 1e12 ? Math.floor(executedAt / 1000) : executedAt;
  } else if (typeof executedAt === "string" && executedAt) {
    const parsed = Date.parse(executedAt);
    if (!isNaN(parsed)) {
      executedAtTs = Math.floor(parsed / 1000);
    }
  }

  const receipt = await prisma.receipt.create({
    data: {
      receiptId,
      intentId: Number(intentId),
      vendor,
      vendorName: vendorName || "",
      token,
      amount: String(amount),
      amountFormatted:
        typeof amountFormatted === "number"
          ? amountFormatted
          : Number(amount) / 1_000_000,
      categoryId: categoryId ?? 0,
      invoiceHash,
      memoHash: memoHash || "",
      txHash: txHash || "",
      executedAt: executedAtTs,
    },
  });

  return NextResponse.json({ receipt }, { status: 201 });
}