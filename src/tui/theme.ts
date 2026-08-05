/**
 * Central visual language for the CodeJet TUI.
 *
 * Everything is defined once here so the interface stays consistent and can be
 * retuned without touching component code. The palette is deliberately
 * restrained: mostly neutral greys with a single blue accent, so output reads
 * like a professional developer tool rather than a christmas tree.
 */

export const COLOR = {
  /** Primary accent — brand, focus rings, active affordances. */
  accent: "#7aa2f7",
  accentSoft: "#5a7bc4",

  /** Roles */
  user: "#9ece6a",
  assistant: "#7aa2f7",
  thinking: "#bb9af7",
  tool: "#e0af68",

  /** Semantic */
  success: "#9ece6a",
  error: "#f7768e",
  warning: "#e0af68",
  info: "#7dcfff",

  /** Text */
  text: "#c0caf5",
  textDim: "#7f88a8",
  muted: "#565f89",

  /** Structure */
  border: "#3b4261",
  borderFocus: "#7aa2f7",

  /** Code */
  code: "#7dcfff",
  codeBg: "#1f2335",
} as const;

/**
 * Glyphs are restricted to a widely supported subset. Anything wider than one
 * terminal cell is avoided: double-width glyphs desynchronise ink's width
 * accounting and are a classic source of drifting borders.
 */
export const GLYPH = {
  brand: "◆",
  user: "❯",
  assistant: "●",
  thinking: "✻",
  tool: "⚒",
  toolDone: "✓",
  toolFail: "✗",
  system: "·",
  bullet: "•",
  quote: "▏",
  gutter: "▏",
  prompt: "❯",
  added: "+",
  removed: "-",
  chevron: "›",
  selected: "❯",
  check: "✓",
  uncheck: "○",
} as const;

/** Braille spinner — smooth and single-width in every terminal we support. */
export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

export const SPINNER_INTERVAL_MS = 80;

/**
 * Horizontal rule helper. Callers pass the width they have already reserved
 * slack for; this never emits more characters than asked.
 */
export function rule(width: number, char = "─"): string {
  return char.repeat(Math.max(0, width));
}

/**
 * Hard-truncate a single-line string to `width` cells, adding an ellipsis when
 * it does not fit. Used everywhere a value must stay on one row (status bar,
 * tool summaries) so it can never wrap and push the layout around.
 */
export function truncate(text: string, width: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (width <= 0) return "";
  if (clean.length <= width) return clean;
  if (width <= 1) return clean.slice(0, width);
  return clean.slice(0, width - 1) + "…";
}
