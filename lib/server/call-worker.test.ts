import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ members: vi.fn(), remove: vi.fn(), reconcile: vi.fn(), notify: vi.fn() }));
vi.mock("./redis", () => ({ redis: { smembers: mock.members, srem: mock.remove } }));
vi.mock("./calls", () => ({ reconcileCall: mock.reconcile, notifyCall: mock.notify }));
import { processCallJobs } from "./call-worker";
beforeEach(() => { vi.resetAllMocks(); mock.notify.mockResolvedValue(true); mock.members.mockResolvedValue(["ring", "ended", "deleted"]); mock.reconcile.mockImplementation(async id => id === "deleted" ? null : { id, status: id === "ended" ? "ended" : "ringing" }); });
it("reconciles without an open client and retries notifications while calls remain pending", async () => {
  await processCallJobs();
  expect(mock.reconcile).toHaveBeenCalledTimes(3);
  expect(mock.notify).toHaveBeenCalledTimes(2);
  expect(mock.remove).toHaveBeenCalledWith("calls:pending:v1", "ended");
  expect(mock.remove).toHaveBeenCalledWith("calls:pending:v1", "deleted");
  expect(mock.remove).not.toHaveBeenCalledWith("calls:pending:v1", "ring");
});
it("retains a finished job if delivery fails and does not starve other jobs", async () => {
  mock.notify.mockImplementation(async call => { if (call.id === "ended") throw new Error("offline"); });
  await processCallJobs();
  expect(mock.remove).not.toHaveBeenCalledWith("calls:pending:v1", "ended");
  expect(mock.remove).toHaveBeenCalledWith("calls:pending:v1", "deleted");
});
