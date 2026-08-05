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

// Route all diagnostic logging to the on-disk log file while the TUI owns the
// terminal. Any stray console output would otherwise be interleaved into the
// live frame.
setTuiActive(true);
registerAllTools();

const instance = render(React.createElement(App), {
  exitOnCtrlC: false,
  // Captures accidental console output from dependencies and replays it above
  // the live frame instead of letting it corrupt the current render.
  patchConsole: true,
});

instance
  .waitUntilExit()
  .catch(() => {})
  .finally(() => {
    setTuiActive(false);
    flushLogs();
  });
