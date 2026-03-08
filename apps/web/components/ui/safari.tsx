import type { SVGProps } from "react";

export interface SafariProps extends SVGProps<SVGSVGElement> {
  url?: string;
  src?: string;
  width?: number;
  height?: number;
}

export function Safari({ src, url, width = 1203, height = 753, ...props }: SafariProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", width: "100%", height: "auto" }}
      {...props}
    >
      <defs>
        <clipPath id="sc2-outer"><rect width={width} height={height} rx="12" /></clipPath>
        <clipPath id="sc2-content">
          <path d="M1 52H1201V741C1201 747.075 1196.08 752 1190 752H12C5.92486 752 1 747.075 1 741V52Z" />
        </clipPath>
        <linearGradient id="sc2-fade" x1="0" y1="680" x2="0" y2="752" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#F8F9FB" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      <g clipPath="url(#sc2-outer)">
        {/* Chrome */}
        <rect width={width} height="52" fill="#EAECEF" />
        <rect y="1" width={width} height="51" fill="#F2F4F6" />
        <circle cx="27" cy="26" r="6.5" fill="#FF5F57" />
        <circle cx="47" cy="26" r="6.5" fill="#FFBD2E" />
        <circle cx="67" cy="26" r="6.5" fill="#28C840" />
        <rect x="286" y="13" width="630" height="26" rx="6" fill="#E2E5E9" />
        <text x="601" y="31" fill="#8A929E" fontSize="11" fontFamily="monospace" textAnchor="middle">
          {url ?? "arbcfo.app/inbox"}
        </text>

        {/* Page */}
        <g clipPath="url(#sc2-content)">
          {/* White page base */}
          <rect x="0" y="52" width={width} height="700" fill="#FFFFFF" />

          {/* ── Sidebar ── */}
          <rect x="0" y="52" width="210" height="700" fill="#F9FAFB" />
          <rect x="209" y="52" width="1" height="700" fill="#E5E7EB" />

          {/* Logo row */}
          <rect x="16" y="74" width="32" height="32" rx="9" fill="#7C3AED" />
          <text x="32" y="95" fill="white" fontSize="14" fontWeight="800" fontFamily="sans-serif" textAnchor="middle">A</text>
          <text x="58" y="88" fill="#111827" fontSize="13" fontWeight="700" fontFamily="sans-serif">ArbCFO</text>
          <text x="58" y="101" fill="#9CA3AF" fontSize="9" fontWeight="500" fontFamily="sans-serif" letterSpacing="1">ARBITRUM TREASURY</text>

          {/* Nav items */}
          {[
            { y: 134, label: "Payables Inbox", active: true, dot: "#7C3AED" },
            { y: 170, label: "Approvals", active: false, dot: null },
            { y: 206, label: "Treasury", active: false, dot: null },
            { y: 242, label: "Risk Oracle", active: false, dot: null },
            { y: 278, label: "Receipts", active: false, dot: null },
            { y: 314, label: "Policies", active: false, dot: null },
            { y: 350, label: "Settings", active: false, dot: null },
          ].map(({ y, label, active }) => (
            <g key={label}>
              {active && <rect x="8" y={y - 6} width="193" height="30" rx="7" fill="#EDE9FE" />}
              <text x="32" y={y + 12} fill={active ? "#7C3AED" : "#6B7280"}
                fontSize="12" fontWeight={active ? "600" : "400"} fontFamily="sans-serif">{label}</text>
              {active && <rect x="202" y={y - 4} width="4" height="26" rx="2" fill="#7C3AED" />}
            </g>
          ))}

          {/* CFO Agent card */}
          <rect x="12" y="680" width="185" height="58" rx="10" fill="#EDE9FE" />
          <text x="24" y="700" fill="#7C3AED" fontSize="11" fontWeight="700" fontFamily="sans-serif">CFO Agent</text>
          <text x="24" y="716" fill="#6B7280" fontSize="9" fontFamily="sans-serif">Agent can propose payment</text>
          <text x="24" y="728" fill="#6B7280" fontSize="9" fontFamily="sans-serif">intents but never execute</text>

          {/* ── Main content ── */}
          {/* Top bar */}
          <rect x="210" y="52" width="993" height="58" fill="#FFFFFF" />
          <rect x="210" y="109" width="993" height="1" fill="#E5E7EB" />
          <text x="236" y="82" fill="#111827" fontSize="18" fontWeight="700" fontFamily="sans-serif">Payables Inbox</text>
          <text x="236" y="100" fill="#9CA3AF" fontSize="11" fontFamily="sans-serif">9 intents</text>

          {/* New Intent button */}
          <rect x="1070" y="66" width="110" height="30" rx="8" fill="#7C3AED" />
          <text x="1125" y="85" fill="white" fontSize="11" fontWeight="600" fontFamily="sans-serif" textAnchor="middle">+ New Intent</text>

          {/* Search bar */}
          <rect x="236" y="122" width="757" height="36" rx="8" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1" />
          <text x="260" y="145" fill="#D1D5DB" fontSize="12" fontFamily="sans-serif">Search vendors, invoices...</text>

          {/* Filter tabs */}
          <rect x="236" y="170" width="32" height="24" rx="6" fill="#111827" />
          <text x="252" y="186" fill="white" fontSize="11" fontWeight="600" fontFamily="sans-serif" textAnchor="middle">All</text>
          <text x="284" y="186" fill="#6B7280" fontSize="11" fontFamily="sans-serif">Awaiting</text>
          <text x="340" y="186" fill="#6B7280" fontSize="11" fontFamily="sans-serif">Executed</text>
          <text x="400" y="186" fill="#6B7280" fontSize="11" fontFamily="sans-serif">Rejected</text>

          {/* Invoice cards */}
          {[
            {
              y: 208, vendor: "Unknown Vendor LLC", id: "UNK-001", amt: "$45,000.00", amtColor: "#111827",
              status: "Rejected", statusBg: "#FEE2E2", statusColor: "#EF4444",
              risk: "35", tag: "General", desc: "Consulting engagement — Q1 2025", time: "2d ago",
            },
            {
              y: 340, vendor: "AWS Billing", id: "INV-2025-003", amt: "$12,000.00", amtColor: "#EF4444",
              status: "Awaiting Approvals", statusBg: "#FEF3C7", statusColor: "#D97706",
              risk: "100", tag: "General", desc: "AWS infrastructure - Feb 2025 (SPIKE — new GPU cluster)", time: "3d ago",
            },
            {
              y: 500, vendor: "Acme Cloud Services", id: "INV-2025-001", amt: "$2,500.00", amtColor: "#111827",
              status: "Awaiting Approvals", statusBg: "#FEF3C7", statusColor: "#D97706",
              risk: "0", tag: "Engineering", desc: "Monthly cloud hosting - January 2025", time: "4d ago",
            },
          ].map(({ y, vendor, id, amt, amtColor, status, statusBg, statusColor, risk, tag, desc, time }) => (
            <g key={id}>
              <rect x="236" y={y} width="953" height="118" rx="12" fill="white" stroke="#E5E7EB" strokeWidth="1" />
              {/* Row 1 */}
              <text x="256" y={y + 26} fill="#111827" fontSize="14" fontWeight="600" fontFamily="sans-serif">{vendor}</text>
              <text x="256" y={y + 44} fill="#9CA3AF" fontSize="11" fontFamily="sans-serif">{id}</text>
              <text x="1165" y={y + 26} fill={amtColor} fontSize="15" fontWeight="700" fontFamily="monospace" textAnchor="end">{amt}</text>
              {/* Badges row */}
              <rect x="256" y={y + 54} width={status.length * 6.5 + 16} height="22" rx="6" fill={statusBg} />
              <text x={256 + (status.length * 6.5 + 16) / 2} y={y + 69} fill={statusColor} fontSize="10" fontWeight="600" fontFamily="sans-serif" textAnchor="middle">{status}</text>

              <rect x={256 + status.length * 6.5 + 24} y={y + 54} width="46" height="22" rx="6" fill={risk === "100" ? "#FEE2E2" : "#DCFCE7"} />
              <text x={256 + status.length * 6.5 + 47} y={y + 69} fill={risk === "100" ? "#EF4444" : "#16A34A"} fontSize="10" fontWeight="700" fontFamily="monospace" textAnchor="middle">⊙ {risk}</text>

              <rect x={256 + status.length * 6.5 + 78} y={y + 54} width={tag.length * 7 + 16} height="22" rx="6" fill="#EDE9FE" />
              <text x={256 + status.length * 6.5 + 86 + tag.length * 3.5} y={y + 69} fill="#7C3AED" fontSize="10" fontFamily="sans-serif" textAnchor="middle">{tag}</text>

              <text x="1165" y={y + 66} fill="#9CA3AF" fontSize="10" fontFamily="sans-serif" textAnchor="end">🕐 {time}</text>
              {/* Description */}
              <text x="256" y={y + 98} fill="#6B7280" fontSize="11" fontFamily="sans-serif">{desc}</text>
            </g>
          ))}

          {/* Bottom fade */}
          <rect x="210" y="660" width="993" height="92" fill="url(#sc2-fade)" />
        </g>

        {/* Window border */}
        <rect x="0.5" y="0.5" width={width - 1} height={height - 1} rx="11.5"
          fill="none" stroke="#D1D5DB" strokeWidth="1" />
      </g>
    </svg>
  );
}
export default Safari;
