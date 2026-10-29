import { spawn, type ChildProcess } from "node:child_process";
import { closeSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { redis } from "./redis";

const state = globalThis as typeof globalThis & { eclipseCallTestSupervisor?: { timer: ReturnType<typeof setInterval>; child?: ChildProcess; pending: boolean; launchedAt: number } };
const local = (value: string) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname);
export function startLocalCallTestHelper() {
  if (process.env.NODE_ENV !== "development" || process.env.CALL_TEST_HELPER_ENABLED !== "1") return;
  try {
    if (!local(process.env.CALL_TEST_ORIGIN || "http://localhost:3000") || !process.env.DATABASE_URL || !local(process.env.DATABASE_URL) || !process.env.REDIS_URL || !local(process.env.REDIS_URL)) return;
  } catch { return; }
  if (state.eclipseCallTestSupervisor) return;
  const supervisor = { timer: undefined as unknown as ReturnType<typeof setInterval>, pending: false, launchedAt: 0, child: undefined as ChildProcess | undefined };
  const tick = async () => {
    if (supervisor.pending) return;
    supervisor.pending = true;
    try {
      if (await redis.get("calls:local-test-helper")) return;
      if (supervisor.child && supervisor.child.exitCode === null && Date.now() - supervisor.launchedAt < 20000) return;
      if (!await redis.setIfAbsent("calls:local-test-helper:launch", randomUUID(), 20)) return;
      const folder = join(process.cwd(), ".cache");
      mkdirSync(folder, { recursive: true });
      const output = openSync(join(folder, "call-test-user.log"), "a"), errors = openSync(join(folder, "call-test-user-error.log"), "a");
      try {
        const child = spawn(process.execPath, [join(process.cwd(), "scripts", "call-test-user.mjs")], { cwd: process.cwd(), detached: true, windowsHide: true, stdio: ["ignore", output, errors] });
        supervisor.child = child; supervisor.launchedAt = Date.now();
        if (child.pid) writeFileSync(join(folder, "call-test-user.pid"), String(child.pid));
        child.on("error", () => { supervisor.child = undefined; console.warn("Local call test helper could not start"); });
        child.unref();
      } finally { closeSync(output); closeSync(errors); }
    } catch { console.warn("Local call test helper recovery deferred"); }
    finally { supervisor.pending = false; }
  };
  supervisor.timer = setInterval(() => { void tick(); }, 10000);
  supervisor.timer.unref();
  state.eclipseCallTestSupervisor = supervisor;
  void tick();
}
