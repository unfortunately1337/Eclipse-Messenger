import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TokenVerifier } from "livekit-server-sdk";
import { callIdentity, issueCallConnection, livekitConfigured, verifyCallJoinToken } from "./livekit";

beforeEach(() => {
  vi.stubEnv("LIVEKIT_URL", "wss://synthetic.livekit.cloud");
  vi.stubEnv("LIVEKIT_API_KEY", "synthetic-api-key");
  vi.stubEnv("LIVEKIT_API_SECRET", "synthetic-secret-used-only-in-unit-tests-123456");
});
afterEach(() => vi.unstubAllEnvs());

describe("LiveKit media credentials", () => {
  it("verifies only signed, room-join tokens for Eclipse call rooms", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const connection = await issueCallConnection(id, "user");
    await expect(verifyCallJoinToken(connection.token)).resolves.toEqual({ id, identity: callIdentity(id, "user") });
    await expect(verifyCallJoinToken(connection.token + "tampered")).rejects.toThrow();
    await expect(verifyCallJoinToken((await issueCallConnection("foreign-room", "user")).token)).rejects.toMatchObject({ status: 403 });
  });
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
  it("allows loopback ws only in development, keeping production TLS mandatory", async () => {
    vi.stubEnv("NODE_ENV", "development");
    for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
      vi.stubEnv("LIVEKIT_URL", `ws://${host}:7880`);
      await expect(issueCallConnection("id", "user")).resolves.toMatchObject({ url: `ws://${host}:7880` });
    }
    for (const url of ["ws://192.168.1.2:7880", "ws://localhost.evil.test:7880", "ws://localhost:7880/path"]) {
      vi.stubEnv("LIVEKIT_URL", url);
      await expect(issueCallConnection("id", "user")).rejects.toMatchObject({ status: 503 });
    }
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LIVEKIT_URL", "ws://127.0.0.1:7880");
    await expect(issueCallConnection("id", "user")).rejects.toMatchObject({ status: 503 });
  });
});
