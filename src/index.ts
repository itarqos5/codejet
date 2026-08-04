#!/usr/bin/env node

import React from "react";
import { render } from "ink";
import App from "./tui/app.js";

render(React.createElement(App), { exitOnCtrlC: true, patchConsole: true });
