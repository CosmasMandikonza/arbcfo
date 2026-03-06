"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Inbox,
  ShieldCheck,
  LayoutDashboard,
  ScrollText,
  FileText,
  Settings,
  Zap,
} from "lucide-react";
import { BackgroundPaths } from "@/components/ui/background-paths";
import { Safari } from "@/components/ui/safari";
import { GlassTimeCard } from "@/components/ui/glass-time-card";
import { Button } from "@/components/ui/button";
import { AnimatedText } from "@/components/ui/animated-text";
import DisplayCards from "@/components/ui/display-cards";
import { Carousel } from "@/components/ui/carousel";
import { Dock, DockIcon, DockItem, DockLabel } from "@/components/ui/dock";

const dockItems = [
  { title: "Inbox", icon: Inbox, href: "/inbox" },
  { title: "Approvals", icon: ShieldCheck, href: "/approvals" },
  { title: "Vault", icon: LayoutDashboard, href: "/vault" },
  { title: "Oracle", icon: Zap, href: "/oracle" },
  { title: "Receipts", icon: ScrollText, href: "/receipts" },
  { title: "Policies", icon: FileText, href: "/policies" },
  { title: "Settings", icon: Settings, href: "/settings" },
];

function RiskRing({ score, label }: { score: number; label: string }) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const color = score < 30 ? "#2EE59D" : score < 70 ? "#F59E0B" : "#FF6B6B";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <svg width="64" height="64" className="-rotate-90">
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="3"
          />
          <motion.circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
            transition={{ duration: 1.8, ease: "easeOut", delay: 0.8 }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color, fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}
        >
          {score}
        </div>
      </div>
      <span className="text-[9px] text-white/30 font-mono uppercase tracking-[0.15em]">
        {label}
      </span>
    </div>
  );
}

function GlassStat({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="flex flex-col items-center gap-1 px-6 py-4 rounded-2xl border border-white/8 backdrop-blur-sm"
      style={{ background: "rgba(255,255,255,0.04)" }}
    >
      <span className="text-2xl font-bold font-mono text-white">{value}</span>
      <span className="text-[10px] text-white/40 font-mono uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

export default function LandingPage() {
  const carouselSlides = [
    {
      title: "Agent Wallet Guardrails",
      description:
        "Autonomous agents query the oracle before every tx. Risk score above threshold blocks it on-chain.",
      button: "View Oracle →",
      src: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2832&auto=format&fit=crop",
    },
    {
      title: "DAO Treasury Protection",
      description:
        "DAOs configure spend policies enforced at contract level. Every payment scored before USDC is released.",
      button: "View Vault →",
      src: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?q=80&w=2832&auto=format&fit=crop",
    },
    {
      title: "Invoice-to-Payment Flow",
      description:
        "GPT-4.1 parses invoices, validates against policy, routes for approval. USDC released on Arbitrum with receipt.",
      button: "Try It →",
      src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop",
    },
  ];

  const displayCardData = [
    {
      className:
        "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-full before:h-full before:rounded-xl before:content-[''] before:bg-[#0D1525]/70 hover:before:opacity-0 before:transition-opacity before:duration-700 before:left-0 before:top-0 grayscale-[70%] hover:grayscale-0",
      icon: <span className="text-base">⚡</span>,
      title: "Rust Risk Engine",
      description: "EMA · MAD · Velocity · Volume on-chain",
      date: "wasm32 · Stylus · native speed",
      titleClassName: "text-[#2EE59D]",
    },
    {
      className:
        "[grid-area:stack] translate-x-16 translate-y-10 hover:-translate-y-1 before:absolute before:w-full before:h-full before:rounded-xl before:content-[''] before:bg-[#0D1525]/40 hover:before:opacity-0 before:transition-opacity before:duration-700 before:left-0 before:top-0 grayscale-[30%] hover:grayscale-0",
      icon: <span className="text-base">🛡️</span>,
      title: "Policy Engine",
      description: "Spend limits enforced at contract level",
      date: "Solidity · Composable · Permissionless",
      titleClassName: "text-[#A78BFA]",
    },
    {
      className: "[grid-area:stack] translate-x-32 translate-y-20 hover:translate-y-10",
      icon: <span className="text-base">🤖</span>,
      title: "AI Invoice Agent",
      description: "GPT-4.1 multi-step structured pipeline",
      date: "Parse · Validate · Approve · Release",
      titleClassName: "text-white",
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#0B1020" }}>
      {/* HERO */}
      <div className="relative">
        <BackgroundPaths title="Permissionless Risk Oracle" />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="absolute top-6 left-6 z-20 flex items-center gap-2.5"
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: "linear-gradient(135deg,#2EE59D,#6D28D9)", color: "#0B1020" }}
          >
            A
          </div>
          <span className="font-display font-semibold text-white/50 text-sm tracking-tight">
            ArbCFO
          </span>
        </motion.div>

        <div className="absolute inset-0 flex flex-col items-center justify-end pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
            className="pointer-events-auto mb-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-mono"
            style={{
              borderColor: "rgba(46,229,157,0.35)",
              background: "rgba(46,229,157,0.07)",
              color: "#2EE59D",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#2EE59D] animate-pulse" />
            Live on Arbitrum Sepolia · 5 contracts deployed
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
            className="pointer-events-auto text-white/35 text-sm max-w-md text-center mb-8 px-6 font-mono leading-relaxed"
          >
            4D anomaly detection in Rust/WASM · Any protocol or agent wallet can query
            real-time risk scores on-chain — no trust required
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.0 }}
            className="pointer-events-auto flex items-center gap-5 mb-8"
          >
            <RiskRing score={12} label="EMA" />
            <RiskRing score={8} label="MAD" />
            <RiskRing score={5} label="Velocity" />
            <RiskRing score={15} label="Volume" />
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-[10px] font-mono font-bold border"
                style={{
                  background: "rgba(46,229,157,0.05)",
                  borderColor: "rgba(46,229,157,0.25)",
                  color: "#2EE59D",
                }}
              >
                OPEN
              </div>
              <span className="text-[9px] text-white/30 font-mono uppercase tracking-[0.15em]">
                Circuit
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.3, type: "spring", stiffness: 120, damping: 20 }}
            className="pointer-events-auto pb-6 w-full flex justify-center"
          >
            <div
              className="border border-white/10 rounded-2xl backdrop-blur-[20px] px-2 py-1"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <Dock panelHeight={56} magnification={72} className="bg-transparent">
                {dockItems.map((item) => (
                  <DockItem
                    key={item.title}
                    className="aspect-square rounded-xl bg-white/10"
                  >
                    <DockLabel className="border-white/10 text-white/70 bg-[rgba(11,16,32,0.85)] backdrop-blur-sm">
                      {item.title}
                    </DockLabel>
                    <DockIcon>
                      <Link
                        href={item.href}
                        className="flex items-center justify-center w-full h-full"
                      >
                        <item.icon
                          className="text-white/60 hover:text-white transition-colors"
                          strokeWidth={1.5}
                          style={{ width: "55%", height: "55%" }}
                        />
                      </Link>
                    </DockIcon>
                  </DockItem>
                ))}
              </Dock>
            </div>
          </motion.div>
        </div>
      </div>

      {/* STATS */}
      <div className="border-y border-white/6 py-8" style={{ background: "#0F1628" }}>
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap items-center justify-around gap-4">
          <GlassStat value="5" label="Contracts Live" />
          <GlassStat value="4D" label="Risk Dimensions" />
          <GlassStat value="Rust" label="Engine Language" />
          <GlassStat value="WASM" label="Stylus Runtime" />
          <GlassStat value="GPT-4.1" label="Invoice Agent" />
        </div>
      </div>

      {/* ARCHITECTURE */}
      <section
        className="py-28 px-6 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0D1A1F 0%, #0B1020 60%)" }}
      >
        <div
          className="absolute top-0 right-0 w-96 h-96 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 100% 0%, rgba(46,229,157,0.07) 0%, transparent 65%)",
          }}
        />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div
                className="inline-block text-xs font-mono px-3 py-1 rounded-full border mb-6"
                style={{
                  borderColor: "rgba(46,229,157,0.3)",
                  color: "#2EE59D",
                  background: "rgba(46,229,157,0.06)",
                }}
              >
                ARCHITECTURE
              </div>
              <AnimatedText
                text="Three layers. One oracle."
                textClassName="text-left text-3xl md:text-4xl"
                className="items-start mb-10"
              />
              <p className="text-white/35 text-sm leading-relaxed mt-8 max-w-sm font-mono">
                Each layer is independently callable. Any protocol can compose ArbCFO
                into their own risk pipeline — no permission required.
              </p>
              <Link href="/inbox" className="mt-8 inline-flex">
                <Button
                  className="rounded-xl px-6 h-10 text-sm font-semibold transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg,#2EE59D,#1BC97E)", color: "#0B1020" }}
                >
                  Explore Dashboard →
                </Button>
              </Link>
            </div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <DisplayCards cards={displayCardData} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* DASHBOARD */}
      <section
        className="py-24 px-6 relative overflow-hidden"
        style={{ background: "linear-gradient(180deg, #E8ECF2 0%, #F0F2F6 50%, #E4E8EF 100%)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 50%, rgba(46,229,157,0.07) 0%, transparent 50%), radial-gradient(circle at 85% 20%, rgba(109,40,217,0.05) 0%, transparent 50%)",
          }}
        />
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div
              className="inline-block text-xs font-mono px-3 py-1 rounded-full border mb-5"
              style={{
                borderColor: "rgba(109,40,217,0.3)",
                color: "#6D28D9",
                background: "rgba(109,40,217,0.08)",
              }}
            >
              DASHBOARD
            </div>
            <motion.div className="flex flex-col items-center justify-center gap-2">
              <div className="relative">
                <motion.h2
                  className="text-3xl md:text-4xl font-bold text-center font-display"
                  style={{ color: "#111827" }}
                  initial={{ y: -20, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  Full treasury visibility.
                </motion.h2>
                <motion.svg width="100%" height="20" viewBox="0 0 300 20" className="absolute -bottom-4 left-0">
                  <motion.path
                    d="M 0,10 Q 100,0 200,10 Q 250,16 300,10"
                    stroke="#6D28D9"
                    strokeWidth="2"
                    fill="none"
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                  />
                </motion.svg>
              </div>
            </motion.div>
            <p className="mt-10 text-sm font-mono leading-relaxed" style={{ color: "#6B7280" }}>
              Payables inbox · Approvals · Treasury vault · Risk oracle
              <br />
              All connected to live on-chain state on Arbitrum Sepolia
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative rounded-2xl overflow-hidden"
            style={{
              boxShadow:
                "0 0 0 1px rgba(0,0,0,0.08), 0 32px 64px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.1)",
            }}
          >
            <Safari
              url="arbcfo.app/inbox"
              style={{ width: "100%", height: "auto", display: "block" }}
            />
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="absolute bottom-8 right-6 z-20"
            >
              <GlassTimeCard showSeconds showTimezone />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* USE CASES */}
      <section
        className="py-28 px-6 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0B1020 0%, #111428 100%)" }}
      >
        <div
          className="absolute bottom-0 left-0 w-full h-64 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 100% at 30% 100%, rgba(46,229,157,0.05) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <div
              className="inline-block text-xs font-mono px-3 py-1 rounded-full border mb-5"
              style={{
                borderColor: "rgba(109,40,217,0.4)",
                color: "#A78BFA",
                background: "rgba(109,40,217,0.08)",
              }}
            >
              USE CASES
            </div>
            <AnimatedText
              text="Who uses the oracle?"
              textClassName="text-3xl md:text-4xl"
              underlinePath="M 0,10 Q 75,2 150,10 Q 225,18 300,10"
            />
          </motion.div>
          <Carousel slides={carouselSlides} />
        </div>
      </section>

      {/* STYLUS */}
      <section
        className="py-20 px-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #100D20 0%, #0B1020 100%)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 80% 50%, rgba(109,40,217,0.14) 0%, transparent 65%)",
          }}
        />
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-2xl border border-white/8 p-10 relative overflow-hidden"
            style={{ background: "rgba(109,40,217,0.07)", backdropFilter: "blur(12px)" }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 80% 50%, rgba(109,40,217,0.22) 0%, transparent 60%)",
              }}
            />
            <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div
                  className="inline-block text-xs font-mono px-3 py-1 rounded-full border mb-6"
                  style={{
                    borderColor: "rgba(167,139,250,0.4)",
                    color: "#A78BFA",
                    background: "rgba(109,40,217,0.12)",
                  }}
                >
                  ARBITRUM STYLUS
                </div>
                <h3 className="font-display font-bold text-2xl text-white mb-4 leading-snug">
                  The first risk oracle
                  <br />
                  written in Rust on Arbitrum.
                </h3>
                <p className="text-white/35 text-sm leading-relaxed font-mono">
                  Stylus runs Rust compiled to WASM with full EVM compatibility. ~10x
                  cheaper compute makes statistical risk scoring viable as a primitive
                  any protocol can call permissionlessly.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Rust", "Risk engine source"],
                  ["WASM", "Execution target"],
                  ["Stylus SDK", "ABI compatible"],
                  ["alloy-sol-types", "Type-safe ABI"],
                ].map(([name, desc]) => (
                  <div
                    key={name}
                    className="rounded-xl p-4 border border-white/8"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <div className="font-mono text-sm font-bold text-white">{name}</div>
                    <div className="text-xs text-white/25 mt-0.5 font-mono">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="py-32 px-6 relative overflow-hidden"
        style={{ background: "linear-gradient(180deg, #0B1020 0%, #0A1A18 100%)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 70% at 50% 100%, rgba(46,229,157,0.08) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <AnimatedText
              text="Composable by default."
              textClassName="text-4xl md:text-5xl"
              underlinePath="M 0,10 Q 75,0 150,10 Q 225,20 300,10"
            />
            <p className="text-white/35 text-base mt-10 mb-10 font-mono leading-relaxed">
              Query the oracle · Enforce policies · Release payments
              <br />
              All on-chain · All auditable · All open
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/inbox">
                <Button
                  className="px-10 py-3 h-auto rounded-xl font-semibold text-base transition-all hover:scale-105"
                  style={{
                    background: "linear-gradient(135deg,#2EE59D,#1BC97E)",
                    color: "#0B1020",
                    boxShadow: "0 0 60px rgba(46,229,157,0.25)",
                  }}
                >
                  Open Dashboard →
                </Button>
              </Link>
              <Link href="/oracle">
                <Button
                  variant="outline"
                  className="px-10 py-3 h-auto rounded-xl font-semibold text-base border transition-all hover:bg-white/5"
                  style={{
                    borderColor: "rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.5)",
                    background: "transparent",
                  }}
                >
                  Query the Oracle
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/6 py-8 px-6" style={{ background: "#080E1C" }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
              style={{ background: "linear-gradient(135deg,#2EE59D,#6D28D9)", color: "#0B1020" }}
            >
              A
            </div>
            <span className="font-display font-semibold text-white/40 text-sm">
              ArbCFO
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/20 font-mono">
            {["vault", "oracle", "policies"].map((p) => (
              <Link
                key={p}
                href={`/${p}`}
                className="capitalize hover:text-white/50 transition-colors"
              >
                {p}
              </Link>
            ))}
            <a
              href="https://sepolia.arbiscan.io/address/0x4EF309545Dc20D90D045238D4e6cf1FB4FC1bC83"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/50 transition-colors"
            >
              Arbiscan ↗
            </a>
          </div>
          <div className="text-xs text-white/10 font-mono">Built on Arbitrum · March 2026</div>
        </div>
      </footer>
    </div>
  );
}