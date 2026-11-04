import { expect, it } from "vitest";
import type { CallView } from "@/lib/calls";
import { personalCallStatus } from "./call-status";

const call = { kind: "direct", status: "ringing", incoming: false, onThisSession: true } as CallView;
it("shows ringing once acknowledged, even while media is still loading", () => {
  for (const media of ["Запрос…", "Ожидание…", "Соединение…", "На связи"]) {
    expect(personalCallStatus(call, media, false)).toBe("Вызов…");
  }
  expect(personalCallStatus({ ...call, requesting: true }, "Ожидание…", false)).toBe("Запрос…");
});
it("moves to connecting after acceptance, preserves recovery and terminal states", () => {
  expect(personalCallStatus({ ...call, status: "active" }, "Ожидание…", false)).toBe("Соединение…");
  expect(personalCallStatus({ ...call, status: "active" }, "Восстанавливаем соединение…", false)).toBe("Восстанавливаем соединение…");
  expect(personalCallStatus(call, "Не удалось подключиться", false)).toBe("Не удалось подключиться");
  expect(personalCallStatus(call, "Ожидание…", true, "missed")).toBe("Нет ответа");
  expect(personalCallStatus({ ...call, incoming: true, onThisSession: false }, "Запрос…", false)).toBe("Входящий звонок");
});
