import { useEffect, useState } from "react";

export interface TerminalSize {
  /** Real reported terminal columns. */
  columns: number;
  /** Real reported terminal rows. */
  rows: number;
  /**
   * Safe content width: one column narrower than the terminal.
   *
   * This matters. If a rendered line is exactly as wide as the terminal, the
   * terminal's own auto-wrap emits an extra line break, which is what produced
   * a blank row after every single line of output. Always lay out against
   * `width`, never against `columns`.
   */
  width: number;
  /** Safe content height, leaving the last row free for the same reason. */
  height: number;
}

function readSize(): TerminalSize {
  const columns = Math.max(20, process.stdout.columns || 80);
  const rows = Math.max(8, process.stdout.rows || 24);
  return {
    columns,
    rows,
    width: Math.max(20, columns - 1),
    height: Math.max(8, rows - 1),
  };
}

/**
 * Tracks terminal dimensions, debounced so a click-drag resize does not trigger
 * a render per pixel (rapid re-renders during resize were another source of
 * torn frames).
 */
export function useTerminalSize(debounceMs = 60): TerminalSize {
  const [size, setSize] = useState<TerminalSize>(readSize);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const onResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const next = readSize();
        setSize((prev) =>
          prev.columns === next.columns && prev.rows === next.rows ? prev : next,
        );
      }, debounceMs);
    };

    process.stdout.on("resize", onResize);
    return () => {
      process.stdout.off("resize", onResize);
      if (timer) clearTimeout(timer);
    };
  }, [debounceMs]);

  return size;
}
