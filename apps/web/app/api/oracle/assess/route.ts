import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  decodeAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

// â”€â”€â”€ Contract Config â”€â”€â”€
const ORACLE_ADDRESS = (process.env.NEXT_PUBLIC_ORACLE_ADDRESS ||
  "0xA22cE447fb4DA7a19DA79896D20B33Cd7AA7B824") as `0x${string}`;

const ORACLE_ABI = parseAbi([
  "function assessRisk(address agent, address vendor, uint256 amount) external returns (uint256 compositeScore, bool blocked, bytes breakdown)",
  "function previewRisk(address agent, address vendor, uint256 amount) external view returns (uint256 compositeScore, bool wouldBlock)",
  "function getEpochCorrelation() external view returns (uint256 epoch, uint256 totalNewVendorSpend, uint256 distinctNewVendors, uint256 spendCapPct, uint256 vendorCapPct)",
  "function getVendorTxCount(address vendor) external view returns (uint256)",
]);

// â”€â”€â”€ Viem Clients â”€â”€â”€
function getClients() {
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL ||
    "https://sepolia-rollup.arbitrum.io/rpc";

  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(rpcUrl),
  });

  // Deployer private key â€” authorized caller on the oracle
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
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

// â”€â”€â”€ POST: Call assessRisk on-chain (real transaction) â”€â”€â”€
export async function POST(request: Request) {
  try {
    const { agent, vendor, amount } = await request.json();

    if (!agent || !vendor || amount === undefined) {
      return NextResponse.json(
        { error: "Missing agent, vendor, or amount" },
        { status: 400 }
      );
    }

    const { publicClient, walletClient } = getClients();

    // Convert amount to USDC base units (6 decimals)
    const amountBigInt = BigInt(Math.floor(Number(amount) * 1e6));

    // If we have a wallet client, send a REAL transaction
    if (walletClient) {
      // First simulate to get return values
      const { result } = await publicClient.simulateContract({
        address: ORACLE_ADDRESS,
        abi: ORACLE_ABI,
        functionName: "assessRisk",
        args: [agent as `0x${string}`, vendor as `0x${string}`, amountBigInt],
        account: walletClient.account,
      });

      const [compositeScore, blocked, breakdown] = result as [
        bigint,
        boolean,
        `0x${string}`
      ];

      // Decode breakdown: (stylusScore, identityScore, correlationScore, compoundBonus, zScore)
      let stylusScore = BigInt(0);
      let identityScore = BigInt(0);
      let correlationScore = BigInt(0);
      let compoundBonus = BigInt(0);

      try {
        const decoded = decodeAbiParameters(
          [
            { type: "uint256", name: "stylusScore" },
            { type: "uint256", name: "identityScore" },
            { type: "uint256", name: "correlationScore" },
            { type: "uint256", name: "compoundBonus" },
            { type: "uint256", name: "zScore" },
          ],
          breakdown
        );
        stylusScore = decoded[0];
        identityScore = decoded[1];
        correlationScore = decoded[2];
        compoundBonus = decoded[3];
      } catch {
        // Breakdown decode failed â€” use composite only
      }

      // Send the real transaction
      const txHash = await walletClient.writeContract({
        address: ORACLE_ADDRESS,
        abi: ORACLE_ABI,
        functionName: "assessRisk",
        args: [agent as `0x${string}`, vendor as `0x${string}`, amountBigInt],
      });

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 30_000,
      });

      // Get updated epoch state
      const epochData = await publicClient.readContract({
        address: ORACLE_ADDRESS,
        abi: ORACLE_ABI,
        functionName: "getEpochCorrelation",
      });

      const [epoch, totalNewVendorSpend, distinctNewVendors, spendCapPct, vendorCapPct] =
        epochData as [bigint, bigint, bigint, bigint, bigint];

      return NextResponse.json({
        compositeScore: Number(compositeScore),
        blocked,
        stylusScore: Number(stylusScore),
        identityScore: Number(identityScore),
        correlationScore: Number(correlationScore),
        compoundBonus: Number(compoundBonus),
        txHash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: Number(receipt.gasUsed),
        onChain: true,
        epoch: {
          totalNewVendorSpend: Number(totalNewVendorSpend) / 1e6,
          distinctNewVendors: Number(distinctNewVendors),
          spendCapPct: Number(spendCapPct),
          vendorCapPct: Number(vendorCapPct),
        },
      });
    }

    // Fallback: use previewRisk (read-only, no private key needed)
    const [compositeScore, wouldBlock] = (await publicClient.readContract({
      address: ORACLE_ADDRESS,
      abi: ORACLE_ABI,
      functionName: "previewRisk",
      args: [agent as `0x${string}`, vendor as `0x${string}`, amountBigInt],
    })) as [bigint, boolean];

    return NextResponse.json({
      compositeScore: Number(compositeScore),
      blocked: wouldBlock,
      onChain: false,
      note: "Preview only â€” add DEPLOYER_PRIVATE_KEY to .env for real transactions",
    });
  } catch (error) {
    console.error("Oracle assess error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// â”€â”€â”€ GET: Read epoch correlation state â”€â”€â”€
export async function GET() {
  try {
    const { publicClient } = getClients();

    const epochData = await publicClient.readContract({
      address: ORACLE_ADDRESS,
      abi: ORACLE_ABI,
      functionName: "getEpochCorrelation",
    });

    const [epoch, totalNewVendorSpend, distinctNewVendors, spendCapPct, vendorCapPct] =
      epochData as [bigint, bigint, bigint, bigint, bigint];

    return NextResponse.json({
      epoch: Number(epoch),
      totalNewVendorSpend: Number(totalNewVendorSpend) / 1e6,
      distinctNewVendors: Number(distinctNewVendors),
      spendCapPct: Number(spendCapPct),
      vendorCapPct: Number(vendorCapPct),
    });
  } catch (error) {
    console.error("Oracle epoch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

