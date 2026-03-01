import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrumSepolia, arbitrum } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "ArbCFO",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [arbitrumSepolia, arbitrum],
  ssr: false,
});

export const CONTRACTS = {
  vault: (process.env.NEXT_PUBLIC_VAULT_ADDRESS || "0x") as `0x${string}`,
  policyEngine: (process.env.NEXT_PUBLIC_POLICY_ENGINE_ADDRESS || "0x") as `0x${string}`,
  receiptRegistry: (process.env.NEXT_PUBLIC_RECEIPT_REGISTRY_ADDRESS || "0x") as `0x${string}`,
  usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS ||
    "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d") as `0x${string}`,
};

export const TARGET_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID || 421614
);