"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { TARGET_CHAIN_ID } from "@/lib/wagmi";
import { AlertTriangle } from "lucide-react";

export function TopBar() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const wrongNetwork = isConnected && chainId !== TARGET_CHAIN_ID;

  return (
    <header className="h-16 border-b border-mist bg-frost flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        {wrongNetwork && (
          <button
            onClick={() => switchChain?.({ chainId: TARGET_CHAIN_ID })}
            className="flex items-center gap-2 rounded-xl bg-coral/10 border border-coral/20 px-3 py-1.5 text-xs font-medium text-coral hover:bg-coral/20 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Wrong network — switch to Arbitrum Sepolia
          </button>
        )}
      </div>
      <ConnectButton
        showBalance={false}
        chainStatus="icon"
        accountStatus="avatar"
      />
    </header>
  );
}
