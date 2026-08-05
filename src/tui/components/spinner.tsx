import React, { useEffect, useState } from "react";
import { Text } from "ink";
import { COLOR, SPINNER_FRAMES, SPINNER_INTERVAL_MS } from "../theme.js";

/**
 * Single-cell braille spinner.
 *
 * Only mounted while something is actually in flight — a permanently animating
 * component forces a full re-render of the tree several times a second for no
 * reason, which is why the old blinking-cursor interval was removed.
 */
export function Spinner({ color = COLOR.accent }: { color?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setFrame((f) => (f + 1) % SPINNER_FRAMES.length),
      SPINNER_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, []);

  return <Text color={color}>{SPINNER_FRAMES[frame]}</Text>;
}

/** Seconds elapsed since `since`, ticking once per second. */
export function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  if (seconds < 1) return null;

  const label = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${seconds % 60}s`;
  return (
    <Text color={COLOR.muted} dimColor>
      {" "}
      {label}
    </Text>
  );
}
