/**
 * Lightweight unit checks for Java scanner pure helpers.
 * Run: node scripts/test-java-scanner.mjs
 */
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Prefer compiled main output; fall back to tsx-less path after build:main
let scanner;
try {
  scanner = require(
    path.join(root, "dist-electron/main/services/launcher/javaScannerService.js"),
  );
} catch {
  console.error("Build main first: npm run build:main");
  process.exit(1);
}

const {
  parseJavaMajor,
  readJavaProperty,
  selectCompatibleJava,
  fallbackRequiredJavaFromMinecraftVersion,
  findJavaExecutables,
} = scanner;

// ── parseJavaMajor ───────────────────────────────────────────────────────────
assert.equal(parseJavaMajor("1.8.0_431"), 8);
assert.equal(parseJavaMajor("1.8"), 8);
assert.equal(parseJavaMajor("17.0.12"), 17);
assert.equal(parseJavaMajor("21.0.10"), 21);
assert.equal(parseJavaMajor("25-ea"), 25);
assert.equal(parseJavaMajor("25.0.1"), 25);
assert.equal(parseJavaMajor("invalid"), null);
assert.equal(parseJavaMajor(""), null);
assert.equal(parseJavaMajor(null), null);

// ── readJavaProperty ─────────────────────────────────────────────────────────
const sample = `
Property settings:
    java.home = C:\\Program Files\\Java\\jdk-21.0.10
    java.specification.version = 21
    java.runtime.version = 21.0.10+7-LTS
    java.version = 21.0.10
    java.vendor = Oracle Corporation
    os.arch = amd64
java version "21.0.10" 2025-01-01 LTS
`;
assert.equal(readJavaProperty(sample, "java.specification.version"), "21");
assert.equal(readJavaProperty(sample, "java.version"), "21.0.10");
assert.equal(readJavaProperty(sample, "java.vendor"), "Oracle Corporation");
assert.equal(readJavaProperty(sample, "missing.key"), null);

// ── selectCompatibleJava ─────────────────────────────────────────────────────
function rt(
  major,
  source = "system",
  javaPath = `C:/java-${major}/bin/java.exe`,
) {
  return {
    id: `java-${major}`,
    javaPath,
    javaHome: path.dirname(path.dirname(javaPath)),
    version: String(major),
    majorVersion: major,
    source,
    valid: true,
    rawVersion: String(major),
    isValid: true,
  };
}

{
  const selected = selectCompatibleJava([rt(17), rt(21), rt(25)], 21);
  assert.ok(selected);
  assert.equal(selected.majorVersion, 21);
}

{
  const selected = selectCompatibleJava([rt(17), rt(25)], 21);
  assert.equal(selected, null); // never auto-pick 25 for required 21
}

{
  const selected = selectCompatibleJava([rt(17), rt(21)], 17);
  assert.ok(selected);
  assert.equal(selected.majorVersion, 17);
}

{
  // managed exact major wins over system
  const selected = selectCompatibleJava(
    [
      rt(21, "system", "C:/sys/bin/java.exe"),
      rt(21, "managed", "C:/managed/bin/java.exe"),
    ],
    21,
  );
  assert.ok(selected);
  assert.equal(selected.source, "managed");
}

// ── fallback required major ──────────────────────────────────────────────────
assert.equal(fallbackRequiredJavaFromMinecraftVersion("1.16.5"), 8);
assert.equal(fallbackRequiredJavaFromMinecraftVersion("1.17.1"), 16);
assert.equal(fallbackRequiredJavaFromMinecraftVersion("1.18.2"), 17);
assert.equal(fallbackRequiredJavaFromMinecraftVersion("1.20.4"), 17);
assert.equal(fallbackRequiredJavaFromMinecraftVersion("1.20.5"), 21);
assert.equal(fallbackRequiredJavaFromMinecraftVersion("1.21.1"), 21);

// ── path discovery for jdk-21.0.10 style folders ─────────────────────────────
const javaRoot = "C:\\Program Files\\Java";
const nestedProbe = path.join(javaRoot, "jdk-21.0.10", "bin", "java.exe");
// Structural expectation: findJavaExecutables must not filter by folder name regex.
// If the folder exists on this machine, assert discovery; otherwise assert pure helpers only.
import fs from "node:fs";
if (fs.existsSync(nestedProbe)) {
  const found = await findJavaExecutables(javaRoot);
  assert.ok(
    found.some(
      (p) =>
        p.toLowerCase().includes("jdk-21.0.10") &&
        p.toLowerCase().endsWith("java.exe"),
    ),
    `Expected to discover ${nestedProbe}, got: ${JSON.stringify(found, null, 2)}`,
  );
  console.log("OK path discovery for jdk-21.0.10");
} else {
  // Still verify nested layout logic with a temp-like structural check via known live installs
  if (fs.existsSync(javaRoot)) {
    const found = await findJavaExecutables(javaRoot);
    assert.ok(
      found.length > 0,
      "Expected at least one java.exe under Program Files\\Java",
    );
    console.log("OK path discovery under Program Files\\Java:", found);
  } else {
    console.log("SKIP path discovery (no Program Files\\Java)");
  }
}

console.log("All java scanner tests passed.");
