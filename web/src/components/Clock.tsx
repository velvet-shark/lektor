"use client";

import { useEffect, useState } from "react";

/**
 * The real clock in the header row — the one authentic piece of "live data"
 * every teletext page carried. Date + HH:MM:SS, always the viewer's local.
 */
export default function Clock() {
  const [now, setNow] = useState<{ d: string; t: string } | null>(null);

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const p = (x: number) => String(x).padStart(2, "0");
      setNow({
        d: `${p(n.getDate())}.${p(n.getMonth() + 1)}`,
        t: `${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="tabular-nums whitespace-nowrap" suppressHydrationWarning>
      <span className="text-tt-white">{now?.d ?? "--.--"}</span>{" "}
      <span className="text-tt-green">{now?.t ?? "--:--:--"}</span>
    </span>
  );
}
