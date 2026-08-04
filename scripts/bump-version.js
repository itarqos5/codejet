import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const parts = pkg.version.split(".");
parts[2] = parseInt(parts[2]) + 1;
pkg.version = parts.join(".");
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`Version bumped to ${pkg.version}`);
