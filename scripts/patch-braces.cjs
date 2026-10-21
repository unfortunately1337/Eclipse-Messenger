// Temporary mitigation for GHSA-vfj7-8cjw-p6xm in braces 3.0.3.
// Upstream has no patched npm release as of 2026-10-08. Bound AST nesting
// before recursive compile/expand/stringify. Preserve normal glob behavior.
const fs = require("node:fs");
const path = require("node:path");
const packagePath = require.resolve("braces/package.json");
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
if (pkg.version !== "3.0.3") {
  throw new Error(`Review braces nesting mitigation for version ${pkg.version}`);
}
const parsePath = path.join(path.dirname(packagePath), "lib/parse.js");
const source = fs.readFileSync(parsePath, "utf8");
const marker = "ECLIPSE_BRACES_MAX_DEPTH";
if (!source.includes(marker)) {
  if ((source.match(/stack\.push\(block\);/g) || []).length !== 2) throw new Error("Unexpected braces parser; review security patch");
  fs.writeFileSync(parsePath, source.replaceAll("stack.push(block);",
    "// ECLIPSE_BRACES_MAX_DEPTH: reject deeply nested attacker patterns.\n      if (stack.length >= 64) throw new SyntaxError('Brace pattern nesting limit exceeded');\n      stack.push(block);"));
}
