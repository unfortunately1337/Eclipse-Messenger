import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TokenVerifier } from "livekit-server-sdk";
import { callIdentity, issueCallConnection, livekitConfigured } from "./livekit";

beforeEach(() => {
  vi.stubEnv("LIVEKIT_URL", "wss://synthetic.livekit.cloud");
  vi.stubEnv("LIVEKIT_API_KEY", "synthetic-api-key");
  vi.stubEnv("LIVEKIT_API_SECRET", "synthetic-secret-used-only-in-unit-tests-123456");
});
afterEach(() => vi.unstubAllEnvs());

describe("LiveKit media credentials", () => {
  it("issues short-lived room-scoped tokens without admin, data, recording, identity or profile disclosures", async () => {
    const result = await issueCallConnection("synthetic-call", "private-user-id");
    const payload = await new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!).verify(result.token);
    expect(payload.sub).toBe(callIdentity("synthetic-call", "private-user-id"));
    expect(payload.sub).not.toContain("private-user-id");
    expect(payload.video).toMatchObject({ room: "eclipse-synthetic-call", roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false, canUpdateOwnMetadata: false });
    expect(payload.video?.roomAdmin).not.toBe(true);
    expect(payload.video?.roomCreate).not.toBe(true);
    expect(payload.video?.roomRecord).not.toBe(true);
    expect(Number(payload.exp) - Number(payload.nbf)).toBeLessThanOrEqual(60);
    expect(result).not.toHaveProperty("secret");
    expect(result.url).toBe("wss://synthetic.livekit.cloud");
  });
  it("fails closed on missing credentials and unsafe websocket endpoints", async () => {
    vi.stubEnv("LIVEKIT_API_SECRET", "");
    expect(livekitConfigured()).toBe(false);
    await expect(issueCallConnection("id", "user")).rejects.toMatchObject({ status: 503 });
    vi.stubEnv("LIVEKIT_API_SECRET", "synthetic-secret");
    for (const url of ["ws://localhost:7880", "https://example.com", "wss://user:pass@example.com", "wss://example.com/path", "wss://example.com?secret=x"]) {
      vi.stubEnv("LIVEKIT_URL", url);
      await expect(issueCallConnection("id", "user")).rejects.toMatchObject({ status: 503 });
    }
  });
});
