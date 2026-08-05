const ENTER_ALTERNATE_SCREEN = "\x1b[?1049h\x1b[H\x1b[2J";
const LEAVE_ALTERNATE_SCREEN = "\x1b[?1049l";

let active = false;

function supportsAlternateScreen(stream: NodeJS.WriteStream): boolean {
  return (
    stream.isTTY === true &&
    !process.env.CI &&
    process.env.TERM !== "dumb"
  );
}

export function enterAlternateScreen(
  stream: NodeJS.WriteStream = process.stdout,
): boolean {
  if (active || !supportsAlternateScreen(stream)) return false;
  stream.write(ENTER_ALTERNATE_SCREEN);
  active = true;
  return true;
}

export function leaveAlternateScreen(
  stream: NodeJS.WriteStream = process.stdout,
): void {
  if (!active) return;
  stream.write(LEAVE_ALTERNATE_SCREEN);
  active = false;
}

/** Clear the alternate buffer before Ink computes a frame after resize. */
export function refreshAlternateScreen(
  stream: NodeJS.WriteStream = process.stdout,
): void {
  if (!active || !supportsAlternateScreen(stream)) return;
  stream.write("\x1b[2J\x1b[H");
}
