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
  enterAlternateScreen,
  leaveAlternateScreen,
} from "./tui/terminal-screen.js";

// Route all diagnostic logging to the on-disk log file while the TUI owns the
// terminal. Any stray console output would otherwise be interleaved into the
// live frame.
setTuiActive(true);
registerAllTools();
enterAlternateScreen();

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
  incrementalRendering: true,
  maxFps: 30,
});

instance
  .waitUntilExit()
  .catch(() => {})
  .finally(restoreTerminal);
