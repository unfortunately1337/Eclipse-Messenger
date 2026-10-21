import { expect, it } from "vitest";
import { customEmojiToken, splitCustomEmoji, emojiPlainText, truncateEmojiText } from "./custom-emoji";
import { EMOJI_STATUS_CATALOG } from "./emoji-status";
import { readForwardedContent, serializeForwardedContent } from "./client/message-forwarding";
it("preserves mixed text, repeats and custom emoji identity across forwarding",()=>{
 const entry=EMOJI_STATUS_CATALOG[0],token=customEmojiToken(entry.id),text=`Hello 😀 ${token}${token} end`;
 expect(splitCustomEmoji(text)).toEqual([{text:'Hello 😀 '},{text:token,id:entry.id},{text:token,id:entry.id},{text:' end'}]);
 expect(emojiPlainText(text)).toBe(`Hello 😀 ${entry.emoji}${entry.emoji} end`);
 expect(readForwardedContent(serializeForwardedContent(text,{name:'Author',link:'author'}))?.content).toBe(text);
});
it("never resolves an unknown ID or a supplied URL into an asset",()=>{
 const unknown='\uE000tg-000000000000000000000000\uE001';
 expect(customEmojiToken('https://untrusted.invalid/asset')).toBe('');
 expect(splitCustomEmoji(unknown)).toEqual([{text:unknown}]);
});
it("truncates reply previews by visible characters without exposing partial emoji tokens",()=>{
 const token=customEmojiToken(EMOJI_STATUS_CATALOG[0].id);
 expect(truncateEmojiText('a'.repeat(79)+token+'more',80)).toBe('a'.repeat(79)+token+'...');
 expect(truncateEmojiText(token.repeat(81),80)).toBe(token.repeat(80)+'...');
 expect(truncateEmojiText('👨‍👩‍👧‍👦'+token,2)).toBe('👨‍👩‍👧‍👦'+token);
});
