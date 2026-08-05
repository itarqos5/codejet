#!/usr/bin/env node

// IMPORTANT: nothing may be written to stdout before ink's renderer takes over.
// Writing raw ANSI (persistent background SGR, screen clears) or resizing the
// console buffer underneath ink desynchronises its frame diffing, which is what
// caused the overlapping borders and doubled blank lines in earlier versions.

import React from "react";
import { render } from "ink";
import App from "./tui/app.js";
import { setTuiActive, flushLogs } from "./api/logger.js";
import { registerAllTools } from "./tools/index.js";
import {
  leaveAlternateScreen,
} from "./tui/terminal-screen.js";

if (process.argv.slice(2).includes("--desktop")) {
  console.log("Coming soon");
  process.exit(0);
}

// Route all diagnostic logging to the on-disk log file while the TUI owns the
// terminal. Any stray console output would otherwise be interleaved into the
// live frame.
setTuiActive(true);
registerAllTools();
// Keep the main terminal buffer so its native scrollbar contains the static
// chat transcript. Ink still owns cursor updates; no raw output is printed.

let restored = false;
const restoreTerminal = () => {
  if (restored) return;
  restored = true;
  leaveAlternateScreen();
  setTuiActive(false);
  flushLogs();
};

process.once("exit", restoreTerminal);

const instance = render(React.createElement(App), {
  exitOnCtrlC: false,
  // Captures accidental console output from dependencies and replays it above
  // the live frame instead of letting it corrupt the current render.
  patchConsole: true,
  // NOTE: incrementalRendering is deliberately off. Combined with <Static> it
  // diffs against stale line offsets, which appended a new frame per keystroke
  // instead of redrawing (the "echo" artifact). Throttling alone is enough.
  maxFps: 30,
});

instance
  .waitUntilExit()
  .catch(() => {})
  .finally(restoreTerminal);
