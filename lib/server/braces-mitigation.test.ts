import { createRequire } from "node:module";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);
const braces = require("braces") as {
  parse: (pattern: string) => unknown;
  compile: (ast: unknown) => string;
  expand: (pattern: string | unknown) => string[];
  stringify: (ast: unknown) => string;
};

it.each(["compile", "expand", "stringify"] as const)("blocks excessive nesting before recursive %s", walker => {
  expect(() => braces[walker](braces.parse("{".repeat(1000) + "a,b" + "}".repeat(1000))))
    .toThrow(/nesting limit/);
});

it("preserves ordinary development glob expansion", () => {
  expect(braces.expand("src/{app,lib}/file.{ts,tsx}")).toEqual([
    "src/app/file.ts", "src/app/file.tsx", "src/lib/file.ts", "src/lib/file.tsx",
  ]);
});
