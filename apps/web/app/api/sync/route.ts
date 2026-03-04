import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPublicClient, http, parseAbiItem } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { IntentStatus } from "@arbcfo/shared";

// Simple event sync - polls for new events and updates DB
// In production, use an indexer like Ponder, Envio, or The Graph

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS as
  | `0x${string}`
  | undefined;
const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";

const client = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(RPC_URL),
});

const IntentCreatedEvent = parseAbiItem(
  "event IntentCreated(uint256 indexed intentId, address indexed operator, address vendor, address token, uint256 amount, uint256 categoryId, bytes32 invoiceHash)"
);

const IntentExecutedEvent = parseAbiItem(
  "event IntentExecuted(uint256 indexed intentId, address indexed executor, bytes32 receiptId)"
);

const ReceiptMintedEvent = parseAbiItem(
  "event ReceiptStored(bytes32 indexed receiptId, uint256 indexed intentId, address vendor, address token, uint256 amount)"
);

let lastSyncedBlock = BigInt(0);

export async function POST(req: NextRequest) {
  if (!VAULT_ADDRESS) {
    return NextResponse.json(
      { error: "Vault address not configured" },
      { status: 503 }
    );
  }

  try {
    const currentBlock = await client.getBlockNumber();
    const lookback = BigInt(1000);
    const one = BigInt(1);
    const zero = BigInt(0);

    const fromBlock =
      lastSyncedBlock > zero
        ? lastSyncedBlock + one
        : currentBlock > lookback
          ? currentBlock - lookback
          : zero;

    if (fromBlock > currentBlock) {
      return NextResponse.json({ synced: 0, upToBlock: Number(currentBlock) });
    }

    const executedLogs = await client.getLogs({
      address: VAULT_ADDRESS,
      event: IntentExecutedEvent,
      fromBlock,
      toBlock: currentBlock,
    });

    let synced = 0;

    for (const log of executedLogs) {
      const intentId = log.args.intentId?.toString();
      const receiptId = log.args.receiptId
        ? String(log.args.receiptId)
        : undefined;

      if (!intentId) continue;

      const intent = await prisma.intent.findFirst({
        where: { onchainId: intentId },
      });

      if (intent && intent.status !== IntentStatus.Executed) {
        const nowTs = Math.floor(Date.now() / 1000);

        await prisma.intent.update({
          where: { id: intent.id },
          data: {
            status: IntentStatus.Executed,
            txHash: log.transactionHash,
            executedAt: nowTs,
          },
        });

        if (receiptId) {
          const existingReceipt = await prisma.receipt.findFirst({
            where: { receiptId },
          });

          if (!existingReceipt) {
            await prisma.receipt.create({
              data: {
                receiptId,
                intentId: intent.id,
                vendor: intent.vendor,
                vendorName: intent.vendorName,
                token: intent.token,
                amount: intent.amount,
                amountFormatted: intent.amountFormatted,
                categoryId: intent.categoryId,
                invoiceHash: intent.invoiceHash,
                memoHash: intent.memoHash || "",
                txHash: log.transactionHash || "",
                executedAt: nowTs,
              },
            });
          }
        }

        synced++;
      }
    }

    lastSyncedBlock = currentBlock;

    return NextResponse.json({
      synced,
      upToBlock: Number(currentBlock),
      eventsFound: executedLogs.length,
    });
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json(
      { error: "Sync failed", details: String(err) },
      { status: 500 }
    );
  }
}