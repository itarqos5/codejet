#!/usr/bin/env node

import { execSync } from "node:child_process";

// Set terminal background color (dark blue-black) and clear
// Using ANSI escape: set background to nearest 256-color dark shade
process.stdout.write("\x1B[48;5;233m"); // Dark background
process.stdout.write("\x1B[2J\x1B[0f"); // Clear screen

// Resize terminal to optimal dimensions if possible
const OPTIMAL_COLS = 120;
const OPTIMAL_ROWS = 35;

try {
  const currentCols = process.stdout.columns ?? 80;
  const currentRows = process.stdout.rows ?? 24;

  if (currentCols < OPTIMAL_COLS || currentRows < OPTIMAL_ROWS) {
    const cols = Math.max(currentCols, OPTIMAL_COLS);
    const rows = Math.max(currentRows, OPTIMAL_ROWS);

    if (process.platform === "win32") {
      execSync(`mode con: cols=${cols} lines=${rows}`, { windowsHide: true, stdio: "ignore" });
    } else {
      process.stdout.write(`\x1B[8;${rows};${cols}t`);
    }
  }
} catch {
  // Ignore resize failures - terminal might not support it
}

// Reset background on exit
process.on("exit", () => {
  process.stdout.write("\x1B[0m"); // Reset all attributes
  process.stdout.write("\x1B[2J\x1B[0f"); // Clear screen
});

import React from "react";
import { render } from "ink";
import App from "./tui/app.js";

render(React.createElement(App), { exitOnCtrlC: false, patchConsole: true });
