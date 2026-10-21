import { describe, expect, it } from "vitest";
import { matchesSavedDialogQuery } from "@/lib/server/saved-dialog-search";

describe("saved dialog search matching", () => {
  it("matches Russian favorites query progressively", () => {
    expect(matchesSavedDialogQuery("из")).toBe(true);
    expect(matchesSavedDialogQuery("избр")).toBe(true);
    expect(matchesSavedDialogQuery("избранное")).toBe(true);
  });

  it("matches english aliases", () => {
    expect(matchesSavedDialogQuery("saved")).toBe(true);
    expect(matchesSavedDialogQuery("fav")).toBe(true);
  });

  it("rejects unrelated queries", () => {
    expect(matchesSavedDialogQuery("dev")).toBe(false);
    expect(matchesSavedDialogQuery("group")).toBe(false);
  });
});
