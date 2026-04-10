import { useEffect, useRef } from "react";

interface AnimatedCounterProps {
  value: number | string;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function formatNumber(n: number): string {
  return n.toLocaleString("es-ES");
}

export default function AnimatedCounter({
  value,
  duration = 1200,
  prefix = "",
  suffix = "",
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (typeof value !== "number" || !ref.current) return;

    const target = value;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(progress);
      const current = Math.round(eased * target);

      if (ref.current) {
        ref.current.textContent = `${prefix}${formatNumber(current)}${suffix}`;
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [value, duration, prefix, suffix]);

  if (typeof value === "string") {
    return (
      <span className={className}>
        {prefix}{value}{suffix}
      </span>
    );
  }

  return (
    <span ref={ref} className={className}>
      {prefix}0{suffix}
    </span>
  );
}
