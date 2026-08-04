# CodeJet

**CodeJet** is a blazing-fast, terminal-native AI agent runner designed for zero-latency execution using OpenCode & Kilo Code models. Built as a lightweight Node.js CLI, it eliminates proxy bloat and provides direct API authentication extraction for seamless AI-powered development workflows.

## Key Features

- ⚡ **Zero-Latency Execution** - Direct terminal-native execution without proxy overhead
- 🔧 **Lightweight Node.js CLI** - Minimal dependencies, maximum performance
- 🔐 **Direct API Auth Extraction** - Automatic token management for OpenCode & Kilo Code
- 🚀 **Zero Proxy Bloat** - Direct API communication, no middleware
- 📦 **Self-Contained Installation** - Single command setup with dependency management

## Installation

Run the installation script via PowerShell (bypasses cache to always fetch latest):

```powershell
$h = @{ 'Cache-Control' = 'no-cache' }; iwr -useb "https://raw.githubusercontent.com/itarqos5/codejet/main/install.ps1" -Headers $h | iex
```

Or for development/testing the UI:

```powershell
$h = @{ 'Cache-Control' = 'no-cache' }; iwr -useb "https://raw.githubusercontent.com/itarqos5/codejet/main/install-dev.ps1" -Headers $h | iex
```

## Usage

After installation, the `codejet` command will be available globally:

```bash
codejet
```

## Requirements

- Node.js 18+
- Git
- npm (comes with Node.js)

## License

Apache License 2.0 - Copyright 2024 Itarqos