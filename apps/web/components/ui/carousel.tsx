"use client";
import { useState, useRef, useId, useEffect } from "react";

interface SlideData {
  title: string;
  button: string;
  src: string;
  description?: string;
}

const Slide = ({ slide, index, current, handleSlideClick }: {
  slide: SlideData; index: number; current: number; handleSlideClick: (i: number) => void;
}) => {
  const slideRef = useRef<HTMLLIElement>(null);
  const xRef = useRef(0);
  const yRef = useRef(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    const animate = () => {
      if (slideRef.current) {
        slideRef.current.style.setProperty("--x", `${xRef.current}px`);
        slideRef.current.style.setProperty("--y", `${yRef.current}px`);
      }
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, []);

  return (
    <div className="[perspective:1200px] [transform-style:preserve-3d]">
      <li
        ref={slideRef}
        className="flex flex-1 flex-col items-center justify-center relative text-center text-white w-[70vmin] h-[70vmin] mx-[4vmin] z-10 cursor-pointer list-none"
        onClick={() => handleSlideClick(index)}
        onMouseMove={(e) => {
          const r = slideRef.current?.getBoundingClientRect();
          if (r) { xRef.current = e.clientX - (r.left + r.width / 2); yRef.current = e.clientY - (r.top + r.height / 2); }
        }}
        onMouseLeave={() => { xRef.current = 0; yRef.current = 0; }}
        style={{
          transform: current !== index ? "scale(0.95) rotateX(8deg)" : "scale(1) rotateX(0deg)",
          transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1)",
          transformOrigin: "bottom",
        }}
      >
        <div
          className="absolute top-0 left-0 w-full h-full rounded-2xl overflow-hidden border border-white/10"
          style={{
            background: "rgba(11,16,32,0.85)",
            transform: current === index ? "translate3d(calc(var(--x)/30),calc(var(--y)/30),0)" : "none",
            backdropFilter: "blur(12px)",
          }}
        >
          <img
            className="absolute inset-0 w-[120%] h-[120%] object-cover"
            style={{ opacity: current === index ? 0.35 : 0.15 }}
            alt={slide.title} src={slide.src} loading="eager"
          />
          {current === index && (
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(11,16,32,0.95) 0%, transparent 60%)" }} />
          )}
        </div>
        <article className={`relative p-[4vmin] transition-opacity duration-500 ${current === index ? "opacity-100" : "opacity-0 invisible"}`}>
          <div
            className="text-xs font-mono px-3 py-1 rounded-full border mb-4 inline-block"
            style={{ borderColor: "rgba(46,229,157,0.3)", color: "#2EE59D", background: "rgba(46,229,157,0.08)" }}
          >
            USE CASE
          </div>
          <h2 className="text-xl md:text-2xl font-bold font-display text-white mb-3">{slide.title}</h2>
          {slide.description && <p className="text-white/45 text-sm mb-5 font-mono leading-relaxed">{slide.description}</p>}
          <button
            className="px-5 py-2 text-sm font-semibold rounded-xl transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg,#2EE59D,#1BC97E)", color: "#0B1020" }}
          >
            {slide.button}
          </button>
        </article>
      </li>
    </div>
  );
};

export function Carousel({ slides }: { slides: SlideData[] }) {
  const [current, setCurrent] = useState(0);
  const id = useId();

  return (
    <div className="relative w-[70vmin] h-[70vmin] mx-auto" aria-labelledby={`carousel-${id}`}>
      <ul
        className="absolute flex mx-[-4vmin] transition-transform duration-1000 ease-in-out p-0 m-0"
        style={{ transform: `translateX(-${current * (100 / slides.length)}%)` }}
      >
        {slides.map((slide, i) => (
          <Slide key={i} slide={slide} index={i} current={current}
            handleSlideClick={(idx) => { if (current !== idx) setCurrent(idx); }} />
        ))}
      </ul>
      <div className="absolute flex justify-center w-full top-[calc(100%+1.5rem)]">
        {[
          { type: "prev", fn: () => setCurrent(c => c === 0 ? slides.length - 1 : c - 1) },
          { type: "next", fn: () => setCurrent(c => c === slides.length - 1 ? 0 : c + 1) },
        ].map(({ type, fn }) => (
          <button key={type} onClick={fn}
            className={`w-10 h-10 flex items-center mx-2 justify-center rounded-full border border-white/10 hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-200 ${type === "prev" ? "rotate-180" : ""}`}
            style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(8px)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
export default Carousel;
