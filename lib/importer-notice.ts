import type { EclipseSystemPayload } from "./eclipse-system";

/** Only use for text sent by Eclipse's trusted system importer account. */
export function importerNoticePayload(text: string): EclipseSystemPayload | null {
  if (!text.trim() || text.startsWith("__eclipse_media__:") || /^\uE000tg-[a-f0-9]{24}\uE001$/.test(text)) return null;
  return { title: text, body: text, eventType: "pack_import", botRole: "assistant", metadata: { importerNotice: true } };
}
