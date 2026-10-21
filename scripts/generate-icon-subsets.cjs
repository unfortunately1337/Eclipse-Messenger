const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

/** Keep the installed SVG implementations, without shipping whole icon catalogues. */
function generateIconSubsets(root) {
  const packages = new Map();
  function scan(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "icon-subsets") scan(file);
      } else if (/\.[tj]sx?$/.test(entry.name)) {
        const text = fs.readFileSync(file, "utf8");
        // Most application/server/test files contain no icon imports. Avoid constructing
        // a TypeScript AST for those files on every dev or production startup.
        if (!text.includes("react-icons/")) continue;
        const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
        for (const node of source.statements) {
          if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
          const pkg = node.moduleSpecifier.text;
          if (!/^react-icons\/[a-z0-9]+$/.test(pkg) || pkg === "react-icons/lib") continue;
          const symbols = node.importClause?.namedBindings;
          if (!symbols || !ts.isNamedImports(symbols)) throw new Error(`Use named icon imports in ${file}`);
          const names = packages.get(pkg) ?? new Set();
          for (const symbol of symbols.elements) if (!symbol.isTypeOnly) names.add(symbol.propertyName?.text ?? symbol.name.text);
          packages.set(pkg, names);
        }
      }
    }
  }
  for (const dir of ["app", "components", "lib", "hooks"]) scan(path.join(root, dir));
  const output = path.join(root, "components", "icon-subsets");
  fs.mkdirSync(output, { recursive: true });
  const aliases = {};
  for (const [pkg, names] of packages) {
    const family = pkg.split("/")[1];
    const source = fs.readFileSync(path.join(root, "node_modules", pkg, "index.mjs"), "utf8");
    let code = '// Generated from installed react-icons (MIT); SVG data remains unchanged.\nimport { GenIcon } from "react-icons/lib";\n';
    for (const name of [...names].sort()) {
      const start = source.indexOf(`export function ${name} (props) {`);
      const end = source.indexOf("\n};", start);
      if (start < 0 || end < 0) throw new Error(`Icon implementation not found: ${pkg}:${name}`);
      code += source.slice(start, end + 3) + "\n";
    }
    const file = path.join(output, family + ".mjs");
    // Avoid invalidating the development compiler when the subset is unchanged.
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== code) fs.writeFileSync(file, code);
    aliases[pkg] = "./components/icon-subsets/" + family + ".mjs";
  }
  return aliases;
}

module.exports = generateIconSubsets;
if (require.main === module) {
  const aliases = generateIconSubsets(process.cwd());
  console.log(`Prepared ${Object.keys(aliases).length} icon families`);
}
