"""
CodeJet Installer
Compiles to EXE via: python -m PyInstaller installer/install.py --onefile --name codejet-installer --distpath .
"""

import ctypes
import json
import os
import subprocess
import sys
from pathlib import Path

# ── ANSI Colors ──────────────────────────────────────────────
CYAN    = "\033[36m"
GREEN   = "\033[32m"
YELLOW  = "\033[33m"
RED     = "\033[31m"
BOLD    = "\033[1m"
DIM     = "\033[2m"
RESET   = "\033[0m"


def banner(text: str) -> None:
    w = 60
    pad = max(0, (w - len(text)) // 2)
    line = "=" * w
    print()
    print(f"{CYAN}{line}{RESET}")
    print(f"{CYAN}{' ' * pad}{BOLD}{text}{RESET}{' ' * (w - pad - len(text))}{CYAN}{RESET}")
    print(f"{CYAN}{line}{RESET}")
    print()


def step(num: str, msg: str) -> None:
    print(f"{CYAN}>> {BOLD}Step {num}{RESET}{CYAN}: {msg}{RESET}")


def ok(msg: str) -> None:
    print(f"{GREEN}  [OK] {msg}{RESET}")


def warn(msg: str) -> None:
    print(f"{YELLOW}  [!] {msg}{RESET}")


def err(msg: str) -> None:
    print(f"{RED}  [X] {msg}{RESET}")


def info(msg: str) -> None:
    print(f"{DIM}  [i] {msg}{RESET}")


def progress(title: str, pct: int, width: int = 40) -> None:
    filled = int(width * pct / 100)
    empty = width - filled
    bar = f"{CYAN}{'#' * filled}{DIM}{'-' * empty}{RESET}"
    print(f"\r{title} [{bar}] {pct}%", end="", flush=True)
    if pct >= 100:
        print()


def prompt_yn(msg: str, default: bool = True) -> bool:
    suffix = " [Y/n] " if default else " [y/N] "
    while True:
        print(f"{CYAN}{msg}{suffix}{RESET}", end="", flush=True)
        choice = input().strip().lower()
        if choice in ("y", "yes"):
            return True
        if choice in ("n", "no"):
            return False
        if choice == "":
            return default
        warn("Please enter Y (yes) or N (no).")


def run(cmd: list[str], check: bool = False, capture: bool = True, **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        capture_output=capture,
        text=True,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        check=check,
        **kwargs,
    )


def is_admin() -> bool:
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False


def elevate_and_rerun() -> None:
    """Re-launch this script as Administrator."""
    script = sys.executable  # EXE path when compiled, python.exe when script
    params = f'"{script}"'
    ctypes.windll.shell32.ShellExecuteW(
        None, "runas", script, None, None, 1
    )
    sys.exit(0)


def check_command(name: str) -> bool:
    try:
        run(["where", name] if sys.platform == "win32" else ["which", name], check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def install_via_winget(package_id: str, name: str) -> bool:
    step("DEP", f"Installing {name} via winget...")
    try:
        run(["winget", "install", "--id", package_id, "--silent",
             "--accept-source-agreements", "--accept-package-agreements"], check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        err(f"Failed to install {name} via winget")
        return False


def refresh_path() -> None:
    machine = os.environ.get("PATH", "")
    user_path = subprocess.run(
        ["reg", "query", "HKCU\\Environment", "/v", "Path"],
        capture_output=True, text=True
    )
    user_paths = ""
    for line in user_path.stdout.splitlines():
        if "Path" in line and "REG_" in line:
            parts = line.split("    ", 3)
            if len(parts) >= 4:
                user_paths = parts[3].strip()
                break
    os.environ["PATH"] = user_paths + ";" + machine if user_paths else machine


def get_provider_token(auth: dict, provider: str, keys: list[str]) -> str | None:
    entry = auth.get(provider)
    if not entry or not isinstance(entry, dict):
        return None
    for k in keys:
        val = entry.get(k)
        if val and str(val).strip():
            return str(val).strip()
    return None


def read_opencode_token(auth: dict) -> str | None:
    return get_provider_token(auth, "opencode", ["key", "access", "token"])


def read_kilo_token(auth: dict) -> str | None:
    return get_provider_token(auth, "kilo", ["access", "token", "key"])


def find_tokens() -> tuple[str | None, str | None]:
    home = Path.home()
    local_app = os.environ.get("LOCALAPPDATA", "")
    app_data = os.environ.get("APPDATA", "")

    opencode_paths = [
        home / ".local" / "share" / "opencode" / "auth.json",
        Path(local_app) / "opencode" / "auth.json" if local_app else None,
        home / ".local" / "share" / "opencode" / "auth.json",
    ]

    kilo_paths = [
        home / ".local" / "share" / "kilo" / "auth.json",
        home / ".local" / "share" / "kilo" / "auth.json",
        Path(app_data) / "kilo" / "auth.json" if app_data else None,
        Path(local_app) / "kilo" / "auth.json" if local_app else None,
    ]

    opencode_token = None
    kilo_token = None

    for p in opencode_paths:
        if p and p.exists():
            try:
                auth = json.loads(p.read_text(encoding="utf-8"))
                t = read_opencode_token(auth)
                if t:
                    opencode_token = t
                    break
            except Exception:
                pass

    for p in kilo_paths:
        if p and p.exists():
            try:
                auth = json.loads(p.read_text(encoding="utf-8"))
                t = read_kilo_token(auth)
                if t:
                    kilo_token = t
                    break
            except Exception:
                pass

    # Fallback: kilo auth status
    if not kilo_token and check_command("kilo"):
        try:
            r = run(["kilo", "auth", "status"])
            import re
            m = re.search(r'token["\s:]+([^\s",}]+)', r.stdout + r.stderr)
            if m:
                kilo_token = m.group(1)
        except Exception:
            pass

    return opencode_token, kilo_token


# ── Main ─────────────────────────────────────────────────────
def main() -> None:
    if not is_admin():
        err("This installer must be run as Administrator.")
        print("  Right-click the installer and choose 'Run as administrator'.")
        input("\nPress Enter to exit...")
        sys.exit(1)

    banner("CodeJet Installation")

    # ── Step 1: System Dependencies ──────────────────────────
    step("1/5", "Checking system dependencies...")

    has_node = check_command("node")
    has_git = check_command("git")

    if not has_node:
        warn("Node.js not found")
        if prompt_yn("Install Node.js via winget?"):
            if not install_via_winget("OpenJS.NodeJS", "Node.js"):
                err("Node.js installation failed. Please install from https://nodejs.org")
                input("Press Enter to exit...")
                sys.exit(1)
            refresh_path()
            has_node = check_command("node")
        else:
            err("Node.js is required. Exiting.")
            input("Press Enter to exit...")
            sys.exit(1)

    if has_node:
        r = run(["node", "--version"])
        ok(f"Node.js found: {r.stdout.strip()}")

    if not has_git:
        warn("Git not found")
        if prompt_yn("Install Git via winget?"):
            if not install_via_winget("Git.Git", "Git"):
                err("Git installation failed. Please install from https://git-scm.com")
                input("Press Enter to exit...")
                sys.exit(1)
            refresh_path()
            has_git = check_command("git")
        else:
            err("Git is required. Exiting.")
            input("Press Enter to exit...")
            sys.exit(1)

    if has_git:
        r = run(["git", "--version"])
        ok(f"Git found: {r.stdout.strip()}")

    # ── Step 2: CLI Tools ────────────────────────────────────
    step("2/5", "Checking OpenCode and Kilo Code CLI...")

    has_opencode = check_command("opencode")
    has_kilo = check_command("kilo")

    if not has_opencode or not has_kilo:
        missing = []
        if not has_opencode:
            missing.append("opencode")
        if not has_kilo:
            missing.append("kilo")
        warn(f"Missing CLI tools: {', '.join(missing)}")

        print(f"{CYAN}Install missing CLI tools globally via npm?{RESET}")
        print(f"  {CYAN}>{RESET} Install OpenCode and Kilo Code")
        print(f"  {CYAN} {RESET} Cancel Installation")
        choice = prompt_yn("Proceed?", default=True)

        if not choice:
            info("Installation cancelled by user.")
            input("Press Enter to exit...")
            sys.exit(0)

        step("2a", "Installing OpenCode and Kilo Code globally...")
        progress("Installing opencode", 0)
        run(["npm", "install", "-g", "opencode"])
        progress("Installing opencode", 50)
        run(["npm", "install", "-g", "@kilocode/cli"])
        progress("Installing @kilocode/cli", 100)

        has_opencode = check_command("opencode")
        has_kilo = check_command("kilo")

        if has_opencode:
            ok("OpenCode installed")
        else:
            err("OpenCode installation failed")
        if has_kilo:
            ok("Kilo Code installed")
        else:
            err("Kilo Code installation failed")
    else:
        ok("OpenCode CLI found")
        ok("Kilo Code CLI found")

    # ── Step 3: Auth Tokens ──────────────────────────────────
    step("3/5", "Checking authentication tokens...")

    opencode_token, kilo_token = find_tokens()

    need_login = False
    if not opencode_token:
        warn("No OpenCode authentication token found")
        need_login = True
    if not kilo_token:
        warn("No Kilo Code authentication token found")
        need_login = True

    if need_login:
        if prompt_yn("No active login found. Would you like to log in now?"):
            step("3a", "Initiating interactive login...")
            if not opencode_token:
                info("Opening OpenCode login...")
                subprocess.run(["opencode", "auth", "login"])
                opencode_token, _ = find_tokens()
            if not kilo_token:
                info("Opening Kilo Code login...")
                subprocess.run(["kilo", "auth", "login"])
                _, kilo_token = find_tokens()
        else:
            info("Skipping authentication. Some features may not work.")

    if opencode_token:
        ok("OpenCode authentication token found")
    if kilo_token:
        ok("Kilo Code authentication token found")

    # ── Step 4: Repository Setup ─────────────────────────────
    step("4/5", "Setting up CodeJet repository...")

    repo_url = "https://github.com/itarqos5/codejet.git"
    target_dir = Path.home() / ".codejet"

    if target_dir.exists():
        info("Removing existing directory...")
        import shutil
        shutil.rmtree(target_dir, ignore_errors=True)

    info("Cloning repository...")
    progress("Cloning", 0)
    r = run(["git", "clone", repo_url, str(target_dir)])
    progress("Cloning", 100)

    if r.returncode != 0:
        err(f"Git clone failed: {r.stderr.strip()}")
        input("Press Enter to exit...")
        sys.exit(1)

    info("Installing npm dependencies...")
    progress("npm install", 0)
    run(["npm", "install"], cwd=str(target_dir))
    progress("npm install", 100)
    ok("Dependencies installed")

    # Add to PATH
    current_path = subprocess.run(
        ["reg", "query", "HKCU\\Environment", "/v", "Path"],
        capture_output=True, text=True
    ).stdout
    target_str = str(target_dir)
    if target_str.lower() not in current_path.lower():
        info("Adding CodeJet to user PATH...")
        subprocess.run(
            ["reg", "add", "HKCU\\Environment", "/v", "Path", "/t", "REG_EXPAND_SZ",
             "/d", f"{current_path.strip()};{target_str}", "/f"],
            capture_output=True
        )
        os.environ["PATH"] = os.environ.get("PATH", "") + ";" + target_str
        ok("Added to PATH (restart terminal to take effect)")
    else:
        ok("Already in PATH")

    # ── Save tokens ──────────────────────────────────────────
    keys_path = target_dir / "keys.json"
    if opencode_token or kilo_token:
        keys = {
            "kilo_token": kilo_token or "",
            "opencode_token": opencode_token or "",
        }
        keys_path.write_text(json.dumps(keys, indent=2), encoding="utf-8")
        ok(f"Authentication tokens saved to {keys_path}")

    # ── Step 5: Completion ───────────────────────────────────
    step("5/5", "Installation complete!")
    print()
    banner("CodeJet installed successfully!")
    print(f"{GREEN}  Run 'codejet' to use the CLI tool!{RESET}")
    print(f"{DIM}  Note: Restart your terminal for PATH changes to take effect.{RESET}")
    print()
    input("Press Enter to exit...")


if __name__ == "__main__":
    main()
