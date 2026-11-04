import type { CallView } from "@/lib/calls";

/** Ringing is a server acknowledgement, independent of media/module loading. */
export function personalCallStatus(call: CallView, mediaState: string, finished: boolean, outcome?: CallView["endOutcome"]) {
  if (finished) return outcome === "cancelled" ? "Звонок отменён" : outcome === "declined" ? "Звонок отклонён" : outcome === "missed" ? "Нет ответа" : "Звонок завершён";
  if (call.incoming) return "Входящий звонок";
  if (!call.onThisSession) return "Звонок открыт на другом устройстве";
  if (call.requesting) return "Запрос…";
  if (mediaState === "Не удалось подключиться" || mediaState === "Соединение прервано") return mediaState;
  if (call.status === "ringing") return "Вызов…";
  return mediaState === "Восстанавливаем соединение…" ? mediaState : "Соединение…";
}
