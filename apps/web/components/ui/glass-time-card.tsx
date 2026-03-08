"use client";
import { useState, useEffect } from "react";

interface GlassTimeCardProps {
  showSeconds?: boolean;
  showTimezone?: boolean;
}

export function GlassTimeCard({ showSeconds = false, showTimezone = false }: GlassTimeCardProps) {
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [timezoneName, setTimezoneName] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -new Date().getTimezoneOffset() / 60;
    setTimezoneName(`${tz} GMT${offset >= 0 ? "+" : ""}${offset}`);
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const formatTime = (d: Date) => d.toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit", second: showSeconds ? "2-digit" : undefined, hour12: false,
  });

  const formatDate = (d: Date) => {
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    return `${days[d.getDay()]} | ${months[d.getMonth()]} ${d.getDate()}`;
  };

  if (!mounted) return null;

  return (
    <div className="w-72 text-white shadow-xl backdrop-blur-xl p-4 rounded-lg border border-white/10"
      style={{ background: "rgba(255,255,255,0.08)" }}>
      <div className="flex flex-col gap-1 items-center">
        <div className="text-sm text-white/60 font-mono">{formatDate(currentTime)}</div>
        <div className="text-4xl font-bold tabular-nums font-mono">{formatTime(currentTime)}</div>
        {showTimezone && <div className="text-xs text-white/30 font-mono">{timezoneName}</div>}
      </div>
    </div>
  );
}
export default GlassTimeCard;
