"use client";
import { motion } from "framer-motion";

const STROKES = [
  "rgba(46,229,157,0.3)",
  "rgba(109,40,217,0.25)",
  "rgba(46,229,157,0.2)",
  "rgba(167,139,250,0.22)",
  "rgba(46,229,157,0.12)",
  "rgba(109,40,217,0.15)",
];

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.6 + i * 0.04,
    stroke: STROKES[i % STROKES.length],
    duration: 18 + i * 0.4,
    delay: i * 0.15,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg className="w-full h-full" viewBox="0 0 696 316" fill="none" preserveAspectRatio="xMidYMid slice">
        {paths.map((p) => (
          <motion.path key={p.id} d={p.d} stroke={p.stroke} strokeWidth={p.width} fill="none"
            initial={{ pathLength: 0.2, opacity: 0 }}
            animate={{ pathLength: [0.2, 1, 0.2], opacity: [0.3, 1, 0.3], pathOffset: [0, 0.6, 0] }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }} />
        ))}
      </svg>
    </div>
  );
}

export function BackgroundPaths({ title = "Background Paths" }: { title?: string }) {
  const words = title.split(" ");
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden" style={{ background: "#0B1020" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(46,229,157,0.04) 0%, rgba(109,40,217,0.07) 40%, transparent 70%)" }} />
      <div className="absolute inset-0"><FloatingPaths position={1} /><FloatingPaths position={-1} /></div>
      <div className="relative z-10 container mx-auto px-4 text-center">
        <h1 className="font-display font-bold tracking-tight" style={{ fontSize: "clamp(3rem,8vw,6.5rem)", lineHeight: 1.05 }}>
          {words.map((word, wi) => (
            <span key={wi} className="inline-block mr-4 last:mr-0">
              {word.split("").map((letter, li) => (
                <motion.span key={`${wi}-${li}`}
                  initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: wi * 0.1 + li * 0.03, type: "spring", stiffness: 150, damping: 25 }}
                  style={{
                    display: "inline-block",
                    color: wi === 1 ? "transparent" : "white",
                    background: wi === 1 ? "linear-gradient(135deg,#2EE59D 0%,#A78BFA 60%,#6D28D9 100%)" : undefined,
                    WebkitBackgroundClip: wi === 1 ? "text" : undefined,
                    backgroundClip: wi === 1 ? "text" : undefined,
                    WebkitTextFillColor: wi === 1 ? "transparent" : undefined,
                  }}>
                  {letter}
                </motion.span>
              ))}
            </span>
          ))}
        </h1>
      </div>
    </div>
  );
}
export default BackgroundPaths;
