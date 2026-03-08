"use client";
import { cn } from "@/lib/utils";

interface DisplayCardProps {
  className?: string;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  date?: string;
  titleClassName?: string;
}

function DisplayCard({ className, icon, title = "Feature", description = "Description", date = "", titleClassName }: DisplayCardProps) {
  return (
    <div className={cn(
      "relative flex h-36 w-[22rem] -skew-y-[8deg] select-none flex-col justify-between rounded-xl border border-white/10 px-4 py-3 transition-all duration-700",
      "backdrop-blur-md",
      "after:absolute after:-right-1 after:top-[-5%] after:h-[110%] after:w-[20rem] after:bg-gradient-to-l after:from-[#0B1020] after:to-transparent after:content-['']",
      "hover:border-white/20 [&>*]:flex [&>*]:items-center [&>*]:gap-2",
      className
    )} style={{ background: "rgba(255,255,255,0.04)" }}>
      <div>
        <span className="relative inline-block rounded-full p-1.5" style={{ background: "rgba(46,229,157,0.12)", border: "1px solid rgba(46,229,157,0.2)" }}>{icon}</span>
        <p className={cn("text-base font-semibold text-white font-display", titleClassName)}>{title}</p>
      </div>
      <p className="text-sm text-white/50 whitespace-nowrap font-mono">{description}</p>
      <p className="text-xs text-white/25 font-mono">{date}</p>
    </div>
  );
}

export default function DisplayCards({ cards }: { cards?: DisplayCardProps[] }) {
  const defaultCards: DisplayCardProps[] = [
    { className: "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-full before:h-full before:rounded-xl before:content-[''] before:bg-[#0B1020]/70 hover:before:opacity-0 before:transition-opacity before:duration-700 before:left-0 before:top-0 grayscale-[70%] hover:grayscale-0" },
    { className: "[grid-area:stack] translate-x-16 translate-y-10 hover:-translate-y-1 before:absolute before:w-full before:h-full before:rounded-xl before:content-[''] before:bg-[#0B1020]/40 hover:before:opacity-0 before:transition-opacity before:duration-700 before:left-0 before:top-0 grayscale-[30%] hover:grayscale-0" },
    { className: "[grid-area:stack] translate-x-32 translate-y-20 hover:translate-y-10" },
  ];
  const displayCards = cards || defaultCards;
  return (
    <div className="grid [grid-template-areas:'stack'] place-items-center animate-in fade-in-0 duration-700">
      {displayCards.map((cardProps, index) => (
        <DisplayCard key={index} {...cardProps} />
      ))}
    </div>
  );
}
