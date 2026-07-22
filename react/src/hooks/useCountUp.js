import { useEffect, useState } from "react";

// Animates a stat-tile value from 0 up to its target once, on mount/target
// change — purely decorative (the DOM already has the final number in props,
// this just eases the visible digits toward it).
export function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
