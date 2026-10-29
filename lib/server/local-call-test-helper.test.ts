import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ get: vi.fn(), claim: vi.fn(), spawn: vi.fn() }));
vi.mock("./redis", () => ({ redis: { get: mock.get, setIfAbsent: mock.claim } }));
vi.mock("node:fs", () => ({ closeSync: vi.fn(), mkdirSync: vi.fn(), openSync: vi.fn(() => 3), writeFileSync: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: mock.spawn }));
import { startLocalCallTestHelper } from "./local-call-test-helper";
const globalState = globalThis as typeof globalThis & { eclipseCallTestSupervisor?: { timer: ReturnType<typeof setInterval> } };
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("CALL_TEST_HELPER_ENABLED", "1"); vi.stubEnv("CALL_TEST_ORIGIN", "http://localhost:3000"); vi.stubEnv("DATABASE_URL", "postgresql://localhost/test"); vi.stubEnv("REDIS_URL", "redis://localhost:6379"); mock.get.mockResolvedValue(null); mock.claim.mockResolvedValue(true); mock.spawn.mockImplementation(() => ({ pid: 1234, exitCode: null, on: vi.fn(), unref: vi.fn() })); });
afterEach(() => { if (globalState.eclipseCallTestSupervisor) clearInterval(globalState.eclipseCallTestSupervisor.timer); delete globalState.eclipseCallTestSupervisor; vi.useRealTimers(); vi.unstubAllEnvs(); });
it("requires explicit local development opt-in and never starts in production or against remote data", async () => {
  vi.stubEnv("NODE_ENV", "production"); startLocalCallTestHelper(); await vi.advanceTimersByTimeAsync(0);
  vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("CALL_TEST_HELPER_ENABLED", "0"); startLocalCallTestHelper(); await vi.advanceTimersByTimeAsync(0);
  vi.stubEnv("CALL_TEST_HELPER_ENABLED", "1"); vi.stubEnv("DATABASE_URL", "postgresql://remote.example/test"); startLocalCallTestHelper(); await vi.advanceTimersByTimeAsync(0);
  expect(mock.spawn).not.toHaveBeenCalled();
});
it("does not duplicate a helper that already owns its Redis lease", async () => {
  mock.get.mockResolvedValue("existing-helper"); startLocalCallTestHelper(); await vi.advanceTimersByTimeAsync(0);
  expect(mock.spawn).not.toHaveBeenCalled();
});
it("launches hidden, keeps one supervisor and restarts an exited child", async () => {
  startLocalCallTestHelper(); startLocalCallTestHelper(); await vi.advanceTimersByTimeAsync(0);
  expect(mock.spawn).toHaveBeenCalledTimes(1);
  expect(mock.spawn).toHaveBeenCalledWith(process.execPath, expect.arrayContaining([expect.stringContaining("call-test-user.mjs")]), expect.objectContaining({ windowsHide: true, detached: true }));
  mock.spawn.mock.results[0].value.exitCode = 1;
  await vi.advanceTimersByTimeAsync(10000);
  expect(mock.spawn).toHaveBeenCalledTimes(2);
});
