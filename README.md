# CodeJet

**CodeJet** is a blazing-fast, terminal-native AI agent runner designed for zero-latency execution using OpenCode & Kilo Code models. Built as a lightweight Node.js CLI, it eliminates proxy bloat and provides direct API authentication extraction for seamless AI-powered development workflows.

## Key Features

- ⚡ **Zero-Latency Execution** - Direct terminal-native execution without proxy overhead
- 🔧 **Lightweight Node.js CLI** - Minimal dependencies, maximum performance
- 🔐 **Direct API Auth Extraction** - Automatic token management for OpenCode & Kilo Code
- 🚀 **Zero Proxy Bloat** - Direct API communication, no middleware
- 📦 **Self-Contained Installation** - Single command setup with dependency management

## Installation

Download the latest `codejet-installer.exe` from [Releases](https://github.com/itarqos5/codejet/releases), then run it as Administrator:

```
Right-click codejet-installer.exe > Run as administrator
```

The installer will:
1. Check and install Node.js & Git if missing
2. Install OpenCode and Kilo Code CLI tools
3. Extract authentication tokens
4. Clone the CodeJet repository to `~/.codejet`
5. Install dependencies and configure your PATH

## Usage

After installation, the `codejet` command will be available globally:

```bash
codejet
```

## Requirements

- Node.js 18+
- Git
- npm (comes with Node.js)

## Building from Source

```bash
python -m pip install pyinstaller
python -m PyInstaller installer/install.py --onefile --name codejet-installer --distpath . --console --clean --noconfirm
```

## License

Apache License 2.0 - Copyright 2024 Itarqos
