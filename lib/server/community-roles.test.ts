import { expect, it } from "vitest";
import { assertRoleDelegation } from "./community-roles";

const admin = { userId: "admin", role: "admin", canManageAdmins: true, canPostMessages: true };
const member = { userId: "member", role: "member" };
it("rejects self escalation and grants outside the administrator's permissions", () => {
  expect(() => assertRoleDelegation("owner", admin, admin, "admin", { memberId: "admin", canChangeName: true })).toThrow("собственные права");
  expect(() => assertRoleDelegation("owner", admin, member, "admin", { memberId: "member", canDeleteForeignMessages: true })).toThrow("которых у вас нет");
});
it("protects more privileged admins and the owner", () => {
  expect(() => assertRoleDelegation("owner", admin, { ...member, role: "admin", canChangeName: true }, "admin", { memberId: "member", role: "member" })).toThrow("которых у вас нет");
  expect(() => assertRoleDelegation("owner", admin, member, "admin", { memberId: "owner" })).toThrow("владельца");
});
it("allows the owner and authorized delegation, rejects ordinary members", () => {
  expect(() => assertRoleDelegation("owner", null, member, "owner", { memberId: "member", canChangeName: true })).not.toThrow();
  expect(() => assertRoleDelegation("owner", admin, member, "admin", { memberId: "member", canPostMessages: true })).not.toThrow();
  expect(() => assertRoleDelegation("owner", member, admin, "member", { memberId: "admin" })).toThrow("Недостаточно прав");
});
it("enforces reaction permission delegation independently of change-info rights", () => {
  expect(() => assertRoleDelegation("owner", { ...admin, canChangeName: true }, member, "admin", { memberId: "member", canChangeReactions: true })).toThrow("которых у вас нет");
  expect(() => assertRoleDelegation("owner", admin, { ...member, role: "admin", canChangeReactions: true }, "admin", { memberId: "member", canChangeReactions: false })).toThrow("которых у вас нет");
  expect(() => assertRoleDelegation("owner", { ...admin, canChangeReactions: true }, member, "admin", { memberId: "member", canChangeReactions: true })).not.toThrow();
});
it("only delegates pin permission when the requesting administrator also has it", () => {
  expect(() => assertRoleDelegation("owner", admin, member, "admin", { memberId: "member", canPinMessages: true })).toThrow("которых у вас нет");
  expect(() => assertRoleDelegation("owner", admin, { ...member, role: "admin", canPinMessages: true }, "admin", { memberId: "member", canPinMessages: false })).toThrow("которых у вас нет");
  expect(() => assertRoleDelegation("owner", { ...admin, canPinMessages: true }, member, "admin", { memberId: "member", canPinMessages: true })).not.toThrow();
  expect(() => assertRoleDelegation("owner", null, member, "owner", { memberId: "member", canPinMessages: true })).not.toThrow();
});
