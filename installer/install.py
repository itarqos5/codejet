"""
CodeJet Installer

Compiles to EXE via:
    python -m PyInstaller installer/install.py --onefile --name codejet-installer \
        --distpath . --console --clean --noconfirm

The console UI deliberately mirrors the CodeJet TUI (see src/tui/theme.ts): the
same Tokyo Night palette, the same single-cell glyph set and the same braille
spinner. Every long-running step is a live task line that animates in place and
then collapses into one status row, so the finished transcript is a flat list of
✓ / ✗ / ! rows rather than a wall of scrolling output.

Degrades cleanly: truecolor -> no color (NO_COLOR, redirected output), unicode
-> ascii glyphs, animated -> one static line per task.
"""

from __future__ import annotations

import atexit
import ctypes
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from contextlib import contextmanager
from pathlib import Path

IS_WIN = sys.platform == "win32"

# ── Console capabilities ─────────────────────────────────────
STD_OUTPUT_HANDLE = -11
ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004


def _enable_vt() -> bool:
    """Turn on ANSI escape handling and UTF-8 output on the Windows console."""
    if not IS_WIN:
        return True
    try:
        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleOutputCP(65001)
        handle = kernel32.GetStdHandle(STD_OUTPUT_HANDLE)
        mode = ctypes.c_ulong()
        if not kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
            return False
        return bool(
            kernel32.SetConsoleMode(
                handle, mode.value | ENABLE_VIRTUAL_TERMINAL_PROCESSING
            )
        )
    except Exception:
        return False


_VT_OK = _enable_vt()

if IS_WIN:
    os.system("")

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def _encodable(sample: str) -> bool:
    encoding = getattr(sys.stdout, "encoding", None) or "ascii"
    try:
        sample.encode(encoding)
        return True
    except Exception:
        return False


IS_TTY = bool(getattr(sys.stdout, "isatty", lambda: False)())
NO_COLOR = bool(os.environ.get("NO_COLOR")) or os.environ.get("CODEJET_NO_COLOR") == "1"
COLOR_ON = _VT_OK and IS_TTY and not NO_COLOR
UNICODE_ON = _encodable("◆✓✗⠋›•")
ANIMATE = _VT_OK and IS_TTY


# ── Palette (src/tui/theme.ts) ───────────────────────────────
def _rgb(hex_str: str) -> str:
    if not COLOR_ON:
        return ""
    h = hex_str.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) for i in (0, 2, 4))
    return f"\033[38;2;{r};{g};{b}m"


class C:
    accent = _rgb("#7aa2f7")
    success = _rgb("#9ece6a")
    error = _rgb("#f7768e")
    warning = _rgb("#e0af68")
    info = _rgb("#7dcfff")
    text = _rgb("#c0caf5")
    dim = _rgb("#7f88a8")
    muted = _rgb("#565f89")
    border = _rgb("#3b4261")
    bold = "\033[1m" if COLOR_ON else ""
    reset = "\033[0m" if COLOR_ON else ""


class G:
    """Single-cell glyphs only — anything wider drifts the right-hand column."""

    brand = "◆" if UNICODE_ON else "*"
    ok = "✓" if UNICODE_ON else "+"
    fail = "✗" if UNICODE_ON else "x"
    warn = "!"
    dot = "·" if UNICODE_ON else "-"
    bullet = "•" if UNICODE_ON else "*"
    chevron = "›" if UNICODE_ON else ">"
    ellipsis = "…" if UNICODE_ON else "..."


SPINNER_FRAMES = (
    ("⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏")
    if UNICODE_ON
    else ("|", "/", "-", "\\")
)
SPINNER_INTERVAL = 0.08

# ── Layout ───────────────────────────────────────────────────
WIDTH = max(52, min(shutil.get_terminal_size((80, 24)).columns - 2, 78))
GUT = "  "
ITEM = "    "
NOTE = "      "


def _row(
    glyph: str,
    glyph_color: str,
    label: str,
    label_color: str = "",
    value: str = "",
    value_color: str = "",
) -> str:
    """One aligned row: `  <glyph> <label>            <value>`."""
    label_color = label_color or C.text
    value_color = value_color or C.muted
    left_plain = f"{ITEM}{glyph} {label}"
    left = f"{ITEM}{glyph_color}{glyph}{C.reset} {label_color}{label}{C.reset}"

    if not value:
        return left

    room = WIDTH - len(left_plain) - 2
    if room <= len(G.ellipsis):
        return left
    if len(value) > room:
        value = value[: room - len(G.ellipsis)] + G.ellipsis
    gap = max(1, WIDTH - len(left_plain) - len(value))
    return left + " " * gap + f"{value_color}{value}{C.reset}"


# ── Renderer ─────────────────────────────────────────────────
class _Renderer:
    """
    Owns stdout. Permanent lines are always printed *above* the live spinner
    line, so a task can log while it is still running without smearing.
    """

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._task: "Task | None" = None
        self._thread: "threading.Thread | None" = None
        self._live = False
        self._cursor_hidden = False
        self._paused = False

    def _write(self, text: str) -> None:
        try:
            sys.stdout.write(text)
            sys.stdout.flush()
        except Exception:
            pass

    def _hide_cursor(self) -> None:
        if ANIMATE and not self._cursor_hidden:
            self._cursor_hidden = True
            self._write("\033[?25l")

    def show_cursor(self) -> None:
        if self._cursor_hidden:
            self._cursor_hidden = False
            self._write("\033[?25h")

    def _clear_live(self) -> None:
        if self._live:
            self._write("\r\033[2K")
            self._live = False

    def _draw_live(self) -> None:
        if self._task is not None and ANIMATE and not self._paused:
            self._write("\r\033[2K" + self._task.render_live())
            self._live = True

    def out(self, line: str = "") -> None:
        with self._lock:
            self._clear_live()
            self._write(line + "\n")
            self._draw_live()

    def start(self, task: "Task") -> None:
        with self._lock:
            self._clear_live()
            self._task = task
            if ANIMATE:
                self._hide_cursor()
                self._draw_live()
                if self._thread is None:
                    self._thread = threading.Thread(target=self._animate, daemon=True)
                    self._thread.start()

    def finish(self, task: "Task") -> None:
        with self._lock:
            if self._task is task:
                self._clear_live()
                self._task = None
            self._write(task.render_final() + "\n")

    def refresh(self) -> None:
        with self._lock:
            self._draw_live()

    def _animate(self) -> None:
        while True:
            time.sleep(SPINNER_INTERVAL)
            with self._lock:
                if self._task is None or self._paused:
                    continue
                self._task.frame += 1
                self._draw_live()

    @contextmanager
    def paused(self):
        """Hand the terminal back for input() or an interactive subprocess."""
        with self._lock:
            self._paused = True
            self._clear_live()
            self.show_cursor()
        try:
            yield
        finally:
            with self._lock:
                self._paused = False
                if self._task is not None:
                    self._hide_cursor()
                    self._draw_live()


R = _Renderer()
atexit.register(R.show_cursor)

_STATUS = {
    "run": (G.dot, C.muted),
    "ok": (G.ok, C.success),
    "fail": (G.fail, C.error),
    "warn": (G.warn, C.warning),
    "skip": (G.dot, C.muted),
}


class Task:
    """A single unit of work rendered as one animated, then permanent, row."""

    def __init__(self, label: str) -> None:
        self.label = label
        self.done_label: "str | None" = None
        self.value = ""
        self.status = "run"
        self.frame = 0
        self.started = time.monotonic()

    @property
    def elapsed(self) -> float:
        return time.monotonic() - self.started

    # -- transitions ------------------------------------------
    def _settle(self, status: str, value: str, label: "str | None") -> None:
        self.status = status
        self.value = value
        if label:
            self.done_label = label

    def ok(self, value: str = "", label: "str | None" = None) -> None:
        self._settle("ok", value, label)

    def fail(self, value: str = "", label: "str | None" = None) -> None:
        self._settle("fail", value, label)

    def warn(self, value: str = "", label: "str | None" = None) -> None:
        self._settle("warn", value, label)

    def skip(self, value: str = "skipped", label: "str | None" = None) -> None:
        self._settle("skip", value, label)

    def set(self, label: str) -> None:
        """Retitle a task while it is still running."""
        with R._lock:
            self.label = label
            R.refresh()

    def note(self, text: str) -> None:
        note(text)

    # -- rendering --------------------------------------------
    def render_live(self) -> str:
        frame = SPINNER_FRAMES[self.frame % len(SPINNER_FRAMES)]
        seconds = self.elapsed
        value = f"{seconds:.0f}s" if seconds >= 2 else ""
        return _row(frame, C.accent, self.label, C.text, value, C.muted)

    def render_final(self) -> str:
        glyph, color = _STATUS[self.status]
        value = self.value
        if not value and self.status == "ok" and self.elapsed >= 2:
            value = f"{self.elapsed:.0f}s"
        label_color = C.dim if self.status == "skip" else C.text
        value_color = {
            "ok": C.muted,
            "fail": C.error,
            "warn": C.warning,
            "skip": C.muted,
            "run": C.muted,
        }[self.status]
        return _row(
            glyph, color, self.done_label or self.label, label_color, value, value_color
        )


@contextmanager
def task(label: str):
    t = Task(label)
    R.start(t)
    try:
        yield t
    except BaseException:
        if t.status == "run":
            t.fail("interrupted")
        R.finish(t)
        raise
    else:
        if t.status == "run":
            t.ok()
        R.finish(t)


# ── Output helpers ───────────────────────────────────────────
def header(subtitle: str) -> None:
    R.out()
    R.out(f"{GUT}{C.accent}{G.brand}{C.reset} {C.bold}{C.text}CodeJet{C.reset}")
    R.out(f"{GUT}  {C.muted}{subtitle}{C.reset}")


def section(title: str) -> None:
    R.out()
    R.out(f"{GUT}{C.accent}{G.bullet}{C.reset} {C.bold}{C.text}{title}{C.reset}")


def ok(label: str, value: str = "") -> None:
    R.out(_row(G.ok, C.success, label, C.text, value, C.muted))


def fail(label: str, value: str = "") -> None:
    R.out(_row(G.fail, C.error, label, C.text, value, C.error))


def warn(label: str, value: str = "") -> None:
    R.out(_row(G.warn, C.warning, label, C.text, value, C.warning))


def info(label: str, value: str = "") -> None:
    R.out(_row(G.dot, C.muted, label, C.dim, value, C.muted))


def note(text: str) -> None:
    R.out(f"{NOTE}{C.muted}{text}{C.reset}")


def prompt_yn(question: str, default: bool = True) -> bool:
    suffix = "(Y/n)" if default else "(y/N)"
    while True:
        with R.paused():
            try:
                sys.stdout.write(
                    f"{NOTE}{C.accent}{G.chevron}{C.reset} {C.text}{question}{C.reset} "
                    f"{C.muted}{suffix}{C.reset} "
                )
                sys.stdout.flush()
                choice = input().strip().lower()
            except EOFError:
                choice = ""
        if choice in ("y", "yes"):
            return True
        if choice in ("n", "no"):
            return False
        if choice == "":
            return default
        note("Please answer y or n.")


def pause_exit(code: int) -> None:
    with R.paused():
        try:
            input(f"{GUT}{C.muted}Press Enter to exit{G.ellipsis}{C.reset}")
        except EOFError:
            pass
    sys.exit(code)


def abort(message: str, hint: str = "") -> None:
    R.out()
    R.out(f"{GUT}{C.error}{G.fail}{C.reset} {C.bold}{C.text}{message}{C.reset}")
    if hint:
        R.out(f"{GUT}  {C.muted}{hint}{C.reset}")
    R.out()
    pause_exit(1)


def short_path(path: Path) -> str:
    text = str(path)
    home = str(Path.home())
    if text.lower().startswith(home.lower()):
        return "~" + text[len(home) :].replace("\\", "/")
    return text


# ── System helpers ───────────────────────────────────────────
def run(
    cmd: list[str],
    check: bool = False,
    capture: bool = True,
    shell: bool = False,
    cwd: "str | None" = None,
    **kwargs,
) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        capture_output=capture,
        text=True,
        shell=shell,
        cwd=cwd,
        creationflags=subprocess.CREATE_NO_WINDOW if IS_WIN and not shell else 0,
        check=check,
        **kwargs,
    )


def version_of(cmd: list[str], fallback: str = "installed") -> str:
    try:
        result = run(cmd)
    except Exception:
        return fallback
    text = (result.stdout or result.stderr or "").strip().splitlines()
    first = text[0] if text else ""
    match = re.search(r"\d+\.\d+(?:\.\d+)?", first)
    return f"v{match.group(0)}" if match else (first or fallback)


def is_admin() -> bool:
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False


def elevate_and_rerun() -> None:
    ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, None, None, 1)
    sys.exit(0)


def check_command(name: str) -> bool:
    try:
        run(["where", name] if IS_WIN else ["which", name], check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def install_via_winget(package_id: str) -> bool:
    try:
        run(
            [
                "winget",
                "install",
                "--id",
                package_id,
                "--silent",
                "--accept-source-agreements",
                "--accept-package-agreements",
            ],
            check=True,
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def _registry_user_path() -> str:
    try:
        result = subprocess.run(
            ["reg", "query", "HKCU\\Environment", "/v", "Path"],
            capture_output=True,
            text=True,
        )
        for line in result.stdout.splitlines():
            if "Path" in line and "REG_" in line:
                parts = line.split("    ", 3)
                if len(parts) >= 4:
                    return parts[3].strip()
    except Exception:
        pass
    return ""


def refresh_path() -> None:
    machine = os.environ.get("PATH", "")
    user_paths = _registry_user_path()
    os.environ["PATH"] = user_paths + ";" + machine if user_paths else machine


def refresh_session_path() -> None:
    """Merge the persisted user PATH from the registry into this session."""
    user_paths = _registry_user_path()
    if user_paths:
        os.environ["PATH"] = user_paths + ";" + os.environ.get("PATH", "")


# ── Token discovery ──────────────────────────────────────────
def get_provider_token(auth: dict, provider: str, keys: list[str]) -> "str | None":
    entry = auth.get(provider)
    if not entry or not isinstance(entry, dict):
        return None
    for key in keys:
        value = entry.get(key)
        if value and str(value).strip():
            return str(value).strip()
    return None


def read_opencode_token(auth: dict) -> "str | None":
    return get_provider_token(auth, "opencode", ["key", "access", "token"])


def read_kilo_token(auth: dict) -> "str | None":
    return get_provider_token(auth, "kilo", ["access", "token", "key"])


def find_tokens() -> "tuple[str | None, str | None]":
    home = Path.home()
    local_app = os.environ.get("LOCALAPPDATA", "")
    app_data = os.environ.get("APPDATA", "")

    opencode_paths = [
        home / ".local" / "share" / "opencode" / "auth.json",
        Path(local_app) / "opencode" / "auth.json" if local_app else None,
    ]
    kilo_paths = [
        home / ".local" / "share" / "kilo" / "auth.json",
        Path(app_data) / "kilo" / "auth.json" if app_data else None,
        Path(local_app) / "kilo" / "auth.json" if local_app else None,
    ]

    opencode_token = None
    kilo_token = None

    for path in opencode_paths:
        if path and path.exists():
            try:
                auth = json.loads(path.read_text(encoding="utf-8"))
                found = read_opencode_token(auth)
                if found:
                    opencode_token = found
                    break
            except Exception:
                pass

    for path in kilo_paths:
        if path and path.exists():
            try:
                auth = json.loads(path.read_text(encoding="utf-8"))
                found = read_kilo_token(auth)
                if found:
                    kilo_token = found
                    break
            except Exception:
                pass

    if not kilo_token and check_command("kilo"):
        try:
            result = run(["kilo", "auth", "status"])
            match = re.search(
                r'token["\s:]+([^\s",}]+)', result.stdout + result.stderr
            )
            if match:
                kilo_token = match.group(1)
        except Exception:
            pass

    return opencode_token, kilo_token


def save_keys(
    target_dir: Path, opencode_token: "str | None", kilo_token: "str | None"
) -> "Path | None":
    if not (opencode_token or kilo_token):
        return None
    keys_path = target_dir / "keys.json"
    keys_path.write_text(
        json.dumps(
            {"kilo_token": kilo_token or "", "opencode_token": opencode_token or ""},
            indent=2,
        ),
        encoding="utf-8",
    )
    return keys_path


# ── Git helpers ──────────────────────────────────────────────
def get_local_head(target_dir: Path) -> "str | None":
    result = run(["git", "rev-parse", "HEAD"], cwd=str(target_dir))
    return result.stdout.strip() if result.returncode == 0 else None


def get_remote_head(repo_url: str) -> "str | None":
    result = run(["git", "ls-remote", repo_url, "refs/heads/main"])
    if result.returncode == 0:
        parts = result.stdout.strip().split()
        if parts:
            return parts[0]
    return None


def has_local_changes(target_dir: Path) -> bool:
    return bool(run(["git", "status", "--porcelain"], cwd=str(target_dir)).stdout.strip())


def package_version(target_dir: Path) -> str:
    try:
        data = json.loads((target_dir / "package.json").read_text(encoding="utf-8"))
        version = str(data.get("version", "")).strip()
        return f"v{version}" if version else ""
    except Exception:
        return ""


# ── Install steps ────────────────────────────────────────────
def ensure_dependency(name: str, command: str, package_id: str, url: str) -> None:
    with task(name) as t:
        present = check_command(command)
        if present:
            t.ok(version_of([command, "--version"]))
        else:
            t.warn("not found")
    if present:
        return

    if not prompt_yn(f"Install {name} with winget?"):
        abort(f"{name} is required", f"Install it from {url} and run this again.")

    outcome = "ok"
    with task(f"Installing {name}") as t:
        if not install_via_winget(package_id):
            outcome = "winget"
            t.fail("winget failed")
        else:
            refresh_path()
            if check_command(command):
                t.ok(version_of([command, "--version"]))
            else:
                outcome = "path"
                t.fail("not on PATH")

    if outcome == "winget":
        abort(f"Could not install {name}", f"Install it manually from {url}.")
    if outcome == "path":
        abort(
            f"{name} installed but is not on PATH",
            "Restart your terminal and run this installer again.",
        )


def ensure_cli_tools() -> "tuple[bool, bool]":
    with task("OpenCode CLI") as t:
        has_opencode = check_command("opencode")
        if has_opencode:
            t.ok("ready")
        else:
            t.warn("not found")
    with task("Kilo Code CLI") as t:
        has_kilo = check_command("kilo")
        if has_kilo:
            t.ok("ready")
        else:
            t.warn("not found")

    if has_opencode and has_kilo:
        return True, True

    if not prompt_yn("Install the missing CLI tools globally with npm?"):
        info("CLI tools", "skipped")
        return has_opencode, has_kilo

    shell = IS_WIN
    if not has_opencode:
        with task("Installing opencode") as t:
            run(["npm", "install", "-g", "opencode"], shell=shell)
            has_opencode = check_command("opencode")
            if has_opencode:
                t.ok("installed")
            else:
                t.fail("npm install failed")
    if not has_kilo:
        with task("Installing @kilocode/cli") as t:
            run(["npm", "install", "-g", "@kilocode/cli"], shell=shell)
            has_kilo = check_command("kilo")
            if has_kilo:
                t.ok("installed")
            else:
                t.fail("npm install failed")

    return has_opencode, has_kilo


def ensure_tokens() -> "tuple[str | None, str | None]":
    with task("Reading credentials") as t:
        opencode_token, kilo_token = find_tokens()
        found = sum(1 for token in (opencode_token, kilo_token) if token)
        t.ok(f"{found}/2 providers", label="Credentials")

    with task("OpenCode account") as t:
        if opencode_token:
            t.ok("authenticated")
        else:
            t.warn("not signed in")
    with task("Kilo Code account") as t:
        if kilo_token:
            t.ok("authenticated")
        else:
            t.warn("not signed in")

    if opencode_token and kilo_token:
        return opencode_token, kilo_token

    if not prompt_yn("Sign in now?"):
        info("Sign-in", "skipped")
        note("Some models will be unavailable until you sign in.")
        return opencode_token, kilo_token

    if not opencode_token:
        note("Opening the OpenCode sign-in flow")
        with R.paused():
            subprocess.run(["opencode", "auth", "login"])
        with task("OpenCode account") as t:
            opencode_token, _ = find_tokens()
            if opencode_token:
                t.ok("authenticated")
            else:
                t.warn("not signed in")

    if not kilo_token:
        note("Opening the Kilo Code sign-in flow")
        with R.paused():
            subprocess.run(["kilo", "auth", "login"])
        with task("Kilo Code account") as t:
            _, kilo_token = find_tokens()
            if kilo_token:
                t.ok("authenticated")
            else:
                t.warn("not signed in")

    return opencode_token, kilo_token


def sync_repository(repo_url: str, target_dir: Path) -> None:
    if target_dir.exists() and (target_dir / ".git").exists():
        with task("Checking for updates") as t:
            local_head = get_local_head(target_dir)
            remote_head = get_remote_head(repo_url)
            local_dirty = has_local_changes(target_dir)
            up_to_date = (
                local_head and remote_head and local_head == remote_head and not local_dirty
            )
            t.ok("up to date" if up_to_date else "changes available")
        if up_to_date:
            return

        if local_dirty:
            with task("Stashing local changes") as t:
                run(["git", "stash"], cwd=str(target_dir))
                t.ok("stashed")

        with task("Pulling latest changes") as t:
            result = run(["git", "pull", "origin", "main"], cwd=str(target_dir))
            if result.returncode == 0:
                t.ok(short_path(target_dir))
                return
            t.fail("pull failed")
        note("Falling back to a clean clone")
        shutil.rmtree(target_dir, ignore_errors=True)
    elif target_dir.exists():
        shutil.rmtree(target_dir, ignore_errors=True)

    with task("Cloning repository") as t:
        result = run(["git", "clone", repo_url, str(target_dir)])
        if result.returncode == 0:
            t.ok(short_path(target_dir))
        else:
            t.fail("clone failed")

    if result.returncode != 0:
        abort("Could not download CodeJet", (result.stderr or "").strip()[:120])


def add_to_path_fallback(target_dir: Path) -> bool:
    current_path = subprocess.run(
        ["reg", "query", "HKCU\\Environment", "/v", "Path"],
        capture_output=True,
        text=True,
    ).stdout
    target_str = str(target_dir)
    if target_str.lower() in current_path.lower():
        return True
    result = subprocess.run(
        [
            "reg",
            "add",
            "HKCU\\Environment",
            "/v",
            "Path",
            "/t",
            "REG_EXPAND_SZ",
            "/d",
            f"{current_path.strip()};{target_str}",
            "/f",
        ],
        capture_output=True,
    )
    return result.returncode == 0


# ── Main ─────────────────────────────────────────────────────
def main() -> None:
    if not is_admin():
        header("installer")
        abort(
            "Administrator rights are required",
            "Right-click the installer and choose 'Run as administrator'.",
        )

    repo_url = "https://github.com/itarqos5/codejet.git"
    target_dir = Path.home() / ".codejet"
    is_update = target_dir.exists() and (target_dir / ".git").exists()

    header("updater" if is_update else f"installer {G.dot} first-time setup")

    section("System")
    ensure_dependency("Node.js", "node", "OpenJS.NodeJS", "https://nodejs.org")
    ensure_dependency("Git", "git", "Git.Git", "https://git-scm.com")

    section("CLI tools")
    ensure_cli_tools()

    section("Authentication")
    opencode_token, kilo_token = ensure_tokens()

    section("Repository")
    sync_repository(repo_url, target_dir)

    shell = IS_WIN
    with task("Installing dependencies") as t:
        deps = run(["npm", "install"], cwd=str(target_dir), shell=shell)
        if deps.returncode != 0:
            t.warn("npm install reported errors")

    with task("Writing credentials") as t:
        keys_path = save_keys(target_dir, opencode_token, kilo_token)
        if keys_path:
            t.ok(short_path(keys_path))
        else:
            t.skip("no tokens")

    section("Command")
    with task("Linking codejet globally") as t:
        result = run(["npm", "install", "-g", "."], cwd=str(target_dir), shell=shell)
        if result.returncode == 0:
            t.ok("global")
        else:
            t.warn("npm link failed")

    if result.returncode != 0:
        with task("Adding CodeJet to PATH") as t:
            if add_to_path_fallback(target_dir):
                t.ok(short_path(target_dir))
            else:
                t.fail("could not edit PATH")

    with task("Refreshing environment") as t:
        refresh_session_path()
        npm_global = subprocess.run(
            ["npm", "root", "-g"], capture_output=True, text=True, shell=shell
        ).stdout.strip()
        if npm_global and npm_global not in os.environ.get("PATH", ""):
            npm_bin = os.path.join(npm_global, ".bin")
            if os.path.isdir(npm_bin):
                os.environ["PATH"] = npm_bin + ";" + os.environ.get("PATH", "")
        has_codejet = check_command("codejet")
        if has_codejet:
            t.ok("ready")
        else:
            t.warn("restart required")

    # ── Summary ──────────────────────────────────────────────
    version = package_version(target_dir)
    R.out()
    R.out(
        f"{GUT}{C.success}{G.ok}{C.reset} "
        f"{C.bold}{C.text}{'Updated' if is_update else 'Installed'}{C.reset}"
        + (f" {C.muted}{version}{C.reset}" if version else "")
    )
    R.out(
        f"{GUT}  {C.dim}Run {C.reset}{C.accent}codejet{C.reset}"
        f"{C.dim} to get started.{C.reset}"
    )
    if not has_codejet:
        R.out(f"{GUT}  {C.muted}Restart your terminal first so PATH picks it up.{C.reset}")
    R.out()
    pause_exit(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        R.show_cursor()
        R.out()
        R.out(f"{GUT}{C.warning}{G.warn}{C.reset} {C.text}Cancelled.{C.reset}")
        R.out()
        sys.exit(130)
    finally:
        R.show_cursor()
