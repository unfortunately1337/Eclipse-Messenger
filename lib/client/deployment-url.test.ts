import { afterEach, expect, it, vi } from "vitest";
import { communityUrl, deploymentUrl, invitationUrl, profileChatUrl } from "./deployment-url";

afterEach(() => vi.unstubAllGlobals());
it.each(["http://localhost:3000", "https://eclpse.ru", "https://preview.example.org"])("keeps public links on %s", origin => {
  for (const kind of ["group", "channel"] as const) {
    const url = new URL(communityUrl("@@example", kind, origin));
    expect(url.origin).toBe(origin);
    expect(url.pathname).toBe("/app");
    expect(url.searchParams.get("chat")).toBe("example");
    expect(url.searchParams.get("chatType")).toBe(kind);
  }
  expect(invitationUrl("a/b?c", origin)).toBe(origin + "/invite/a%2Fb%3Fc");
  expect(profileChatUrl("@name", origin)).toBe(origin + "/app?chat=name");
});
it("uses the browser deployment and does not permit foreign URL injection", () => {
  vi.stubGlobal("window", { location: { origin: "http://localhost:4321" } });
  expect(profileChatUrl("alice").startsWith("http://localhost:4321/")).toBe(true);
  expect(new URL(communityUrl("//evil.test?x=1", "group")).origin).toBe("http://localhost:4321");
  for (const path of ["//evil.test", "https://evil.test", "/\\evil.test"]) expect(() => deploymentUrl(path)).toThrow();
});
