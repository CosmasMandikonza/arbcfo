"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Inbox,
  CheckCircle2,
  Vault,
  Receipt,
  Shield,
  Settings,
  Bot,
  Zap,
  Brain,
} from "lucide-react";

const navItems = [
  { href: "/inbox", label: "Payables Inbox", icon: Inbox },
  { href: "/approvals", label: "Approvals", icon: CheckCircle2 },
  { href: "/vault", label: "Treasury", icon: Vault },
  { href: "/oracle", label: "Risk Oracle", icon: Brain },
  { href: "/receipts", label: "Receipts", icon: Receipt },
  { href: "/policies", label: "Policies", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-frost border-r border-mist flex flex-col">
      {/* Logo */}
      <div className="p-6 pb-4">
        <Link href="/inbox" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-iris flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-ink tracking-tight">
              ArbCFO
            </h1>
            <p className="text-[10px] text-ink-light font-medium tracking-wider uppercase">
              Arbitrum Treasury
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                isActive ? "sidebar-link-active" : "sidebar-link"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Agent Assistant Panel */}
      <div className="p-3 m-3 mb-4 rounded-2xl bg-iris/5 border border-iris/10">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-4 h-4 text-iris" />
          <span className="text-xs font-semibold text-iris">CFO Agent</span>
        </div>
        <p className="text-[11px] text-ink-muted leading-relaxed">
          Agent can propose payment intents but never execute without approvals.
        </p>
      </div>

      {/* Version */}
      <div className="px-6 py-3 border-t border-mist">
        <p className="text-[10px] text-ink-light">v0.2.0 · Arbitrum Sepolia + Robinhood Chain</p>
      </div>
    </aside>
  );
}
