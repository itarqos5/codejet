import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(pkg.version));

if (!match) {
  throw new Error(`Invalid package version: ${pkg.version}`);
}

let major = Number(match[1]);
let minor = Number(match[2]);
let patch = Number(match[3]);

// Keep patch releases single-digit: 1.2.9 becomes 1.3.0.
if (patch >= 9) {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

pkg.version = `${major}.${minor}.${patch}`;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`Version bumped to ${pkg.version}`);
