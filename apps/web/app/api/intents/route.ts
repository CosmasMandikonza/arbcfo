import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IntentStatus } from "@arbcfo/shared";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  decodeAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

// â”€â”€â”€ Oracle Config â”€â”€â”€
const ORACLE_ADDRESS = (process.env.NEXT_PUBLIC_ORACLE_ADDRESS ||
  "") as `0x${string}`;

const ORACLE_ABI = parseAbi([
  "function assessRisk(address agent, address vendor, uint256 amount) external returns (uint256 compositeScore, bool blocked, bytes breakdown)",
  "function previewRisk(address agent, address vendor, uint256 amount) external view returns (uint256 compositeScore, bool wouldBlock)",
]);

function getOracleClients() {
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL ||
    "https://sepolia-rollup.arbitrum.io/rpc";

  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(rpcUrl),
  });

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY as
    | `0x${string}`
    | undefined;
  if (!privateKey) {
    return { publicClient, walletClient: null };
  }

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(rpcUrl),
  });

  return { publicClient, walletClient };
}

// â”€â”€â”€ Call the oracle and return decision + tx hash â”€â”€â”€
async function callOracle(
  vendor: string,
  amountUsdc: number
): Promise<{
  riskScore: number;
  decision: "SAFE" | "REVIEW" | "BLOCKED";
  txHash: string | null;
  breakdown: Record<string, number> | null;
  onChain: boolean;
}> {
  // Use deployer as the "agent" â€” in production this would be the entity
  // initiating the transaction
  const agent =
    "0x2518900d8e252688a5d5D93bc4AeAa99EB13B211" as `0x${string}`;
  const vendorAddr = vendor as `0x${string}`;
  const amountBigInt = BigInt(Math.floor(amountUsdc * 1e6));

  const { publicClient, walletClient } = getOracleClients();

  if (!ORACLE_ADDRESS || ORACLE_ADDRESS === "0x") {
    return {
      riskScore: 0,
      decision: "SAFE",
      txHash: null,
      breakdown: null,
      onChain: false,
    };
  }

  // If we have a wallet client, call assessRisk (real tx)
  if (walletClient) {
    try {
      // Simulate first to get return values
      const { result } = await publicClient.simulateContract({
        address: ORACLE_ADDRESS,
        abi: ORACLE_ABI,
        functionName: "assessRisk",
        args: [agent, vendorAddr, amountBigInt],
        account: walletClient.account,
      });

      const [compositeScore, blocked, breakdownBytes] = result as [
        bigint,
        boolean,
        `0x${string}`
      ];

      let breakdownObj: Record<string, number> = {};
      try {
        const decoded = decodeAbiParameters(
          [
            { type: "uint256", name: "stylusScore" },
            { type: "uint256", name: "identityScore" },
            { type: "uint256", name: "correlationScore" },
            { type: "uint256", name: "compoundBonus" },
            { type: "uint256", name: "zScore" },
          ],
          breakdownBytes
        );
        breakdownObj = {
          stylusScore: Number(decoded[0]),
          identityScore: Number(decoded[1]),
          correlationScore: Number(decoded[2]),
          compoundBonus: Number(decoded[3]),
        };
      } catch {
        // breakdown decode failed
      }

      // Send the real transaction
      const txHash = await walletClient.writeContract({
        address: ORACLE_ADDRESS,
        abi: ORACLE_ABI,
        functionName: "assessRisk",
        args: [agent, vendorAddr, amountBigInt],
      });

      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 30_000,
      });

      const score = Number(compositeScore);
      let decision: "SAFE" | "REVIEW" | "BLOCKED" = "SAFE";
      if (blocked || score > 70) decision = "BLOCKED";
      else if (score > 40) decision = "REVIEW";

      return {
        riskScore: score,
        decision,
        txHash,
        breakdown: breakdownObj,
        onChain: true,
      };
    } catch (err) {
      console.error("assessRisk tx failed, trying previewRisk:", err);
      // Fall through to preview
    }
  }

  // Fallback: previewRisk (read-only)
  try {
    const [compositeScore, wouldBlock] = (await publicClient.readContract({
      address: ORACLE_ADDRESS,
      abi: ORACLE_ABI,
      functionName: "previewRisk",
      args: [agent, vendorAddr, amountBigInt],
    })) as [bigint, boolean];

    const score = Number(compositeScore);
    let decision: "SAFE" | "REVIEW" | "BLOCKED" = "SAFE";
    if (wouldBlock || score > 70) decision = "BLOCKED";
    else if (score > 40) decision = "REVIEW";

    return {
      riskScore: score,
      decision,
      txHash: null,
      breakdown: null,
      onChain: false,
    };
  } catch (err) {
    console.error("previewRisk failed:", err);
    // Total fallback â€” no oracle available
    return {
      riskScore: 0,
      decision: "SAFE",
      txHash: null,
      breakdown: null,
      onChain: false,
    };
  }
}

// â”€â”€â”€ GET: List intents â”€â”€â”€
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (status && status !== "all") {
    const statuses = status
      .split(",")
      .map(Number)
      .filter((n) => !isNaN(n));
    if (statuses.length === 1) {
      where.status = statuses[0];
    } else if (statuses.length > 1) {
      where.status = { in: statuses };
    }
  }
  if (search) {
    where.OR = [
      { vendorName: { contains: search } },
      { invoiceNumber: { contains: search } },
      { memo: { contains: search } },
      { vendor: { contains: search } },
    ];
  }

  const intents = await prisma.intent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { approvals: true },
  });

  return NextResponse.json({ intents });
}

// â”€â”€â”€ POST: Create intent â†’ call oracle â†’ route â”€â”€â”€
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    vendor,
    vendorName,
    amount,
    amountFormatted,
    categoryId,
    invoiceHash,
    memoHash,
    invoiceNumber,
    dueDate,
    memo,
    token,
    creator,
  } = body;

  if (!vendor || !amount || !invoiceHash) {
    return NextResponse.json(
      { error: "Missing required fields: vendor, amount, invoiceHash" },
      { status: 400 }
    );
  }

  // Duplicate check
  const existing = await prisma.intent.findFirst({
    where: { invoiceHash },
  });
  if (existing) {
    return NextResponse.json(
      {
        error: "Invoice with this hash already exists",
        intentId: existing.id,
      },
      { status: 409 }
    );
  }

  const nowTs = Math.floor(Date.now() / 1000);

  // Parse dueDate
  let dueDateInt = nowTs + 7 * 86400;
  if (typeof dueDate === "number") {
    dueDateInt = dueDate > 1e12 ? Math.floor(dueDate / 1000) : dueDate;
  } else if (typeof dueDate === "string" && dueDate) {
    const parsed = Date.parse(dueDate);
    if (!isNaN(parsed)) dueDateInt = Math.floor(parsed / 1000);
  }

  const amtFormatted =
    typeof amountFormatted === "number" ? amountFormatted : 0;

  // â”€â”€â”€ CALL THE REAL ORACLE â”€â”€â”€
  const oracleResult = await callOracle(vendor, amtFormatted);

  // Route based on oracle decision
  let intentStatus: number = IntentStatus.AwaitingApprovals;
  if (
    oracleResult.decision === "REVIEW" ||
    oracleResult.decision === "BLOCKED"
  ) {
    intentStatus = IntentStatus.PendingRiskReview;
  }

  const intent = await prisma.intent.create({
    data: {
      vendor,
      vendorName: vendorName || "",
      amount: String(amount),
      amountFormatted: amtFormatted,
      categoryId: categoryId ?? 0,
      invoiceHash,
      memoHash:
        memoHash ||
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      invoiceNumber: invoiceNumber || "",
      dueDate: dueDateInt,
      memo: memo || "",
      token: token || process.env.NEXT_PUBLIC_USDC_ADDRESS || "",
      status: intentStatus,
      creator: creator || "",
      createdAt: nowTs,
      approvalCount: 0,
      executedAt: 0,
      // Oracle fields
      riskScore: oracleResult.riskScore,
      oracleDecision: oracleResult.decision,
      oracleTxHash: oracleResult.txHash,
      oracleBreakdown: oracleResult.breakdown
        ? JSON.stringify(oracleResult.breakdown)
        : null,
    },
  });

  return NextResponse.json(
    {
      intent,
      oracle: {
        riskScore: oracleResult.riskScore,
        decision: oracleResult.decision,
        txHash: oracleResult.txHash,
        onChain: oracleResult.onChain,
      },
    },
    { status: 201 }
  );
}


