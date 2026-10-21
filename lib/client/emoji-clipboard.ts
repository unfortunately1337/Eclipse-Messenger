import { emojiPlainText } from "@/lib/custom-emoji";
export const EMOJI_CLIPBOARD_TYPE = "application/x-eclipse-emoji-text";
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]!);
export function emojiClipboardHtml(text: string) {
  return `<span data-eclipse-emoji-text="${escapeHtml(text)}">${escapeHtml(emojiPlainText(text))}</span>`;
}
export function readEmojiClipboard(data: Pick<DataTransfer,"getData">) {
  const custom = data.getData(EMOJI_CLIPBOARD_TYPE);
  if (custom) return custom;
  const html = data.getData("text/html");
  // Only read inert text metadata; never insert clipboard HTML into the editor.
  if (html && html.length < 200_000) {
    const value = new DOMParser().parseFromString(html,"text/html").querySelector("[data-eclipse-emoji-text]")?.getAttribute("data-eclipse-emoji-text");
    if (value !== null && value !== undefined) return value;
  }
  return data.getData("text/plain");
}
export async function writeEmojiClipboard(text: string) {
  if(typeof ClipboardItem!=="undefined"&&navigator.clipboard.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/plain":new Blob([emojiPlainText(text)],{type:"text/plain"}),
        "text/html":new Blob([emojiClipboardHtml(text)],{type:"text/html"}),
      })]);
      return;
    } catch { /* Plain text is still useful in browsers without rich clipboard access. */ }
  }
  await navigator.clipboard.writeText(emojiPlainText(text));
}
