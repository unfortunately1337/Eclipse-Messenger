import { createRequire } from "node:module";
import { expect, it } from "vitest";
const require = createRequire(import.meta.url);
const braces = require("braces") as (input: string) => string[];
it("rejects deeply nested glob patterns before exhausting the call stack", () => {
  expect(() => braces("{".repeat(4000) + "a,b" + "}".repeat(4000))).toThrow("nesting limit");
  expect(braces("src/{a,b}/*.ts")).toEqual(["src/(a|b)/*.ts"]);
});
