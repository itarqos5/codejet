#!/usr/bin/env node

// Clear terminal before rendering TUI
process.stdout.write("\x1B[2J\x1B[0f");

import React from "react";
import { render } from "ink";
import App from "./tui/app.js";

render(React.createElement(App), { exitOnCtrlC: true, patchConsole: true });
