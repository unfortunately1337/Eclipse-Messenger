import { describe, it, expect, vi } from "vitest";
import { readForwardedContent, serializeForwardedContent, copyForwardMedia, FORWARD_PREFIX } from "./message-forwarding";
describe("message forwarding", () => {
 it("preserves original author when forwarding again without nested envelopes", () => {
  const first = serializeForwardedContent("hello", { id: "original", name: "Friend" });
  expect(readForwardedContent(serializeForwardedContent(first, {name:"Second"}))).toEqual({content:"hello",author:{id:"original",name:"Friend"}});
 });
 it("rejects malformed and nested envelopes and executable avatar URLs", () => {
  expect(readForwardedContent(FORWARD_PREFIX+"{}" )).toBeNull();
  expect(readForwardedContent(FORWARD_PREFIX+JSON.stringify({content:FORWARD_PREFIX+"{}",author:{name:"x"}}))).toBeNull();
  expect(readForwardedContent(serializeForwardedContent("hi", {name:"x",avatarUrl:"javascript:alert(1)"}))?.author.avatarUrl).toBeUndefined();
 });
 it("copies album attachments once and keeps captions and durations", async () => {
  const copy=vi.fn(async (url:string)=>url+"-new");
  const result=await copyForwardMedia("__eclipse_media__:"+JSON.stringify({type:"album",caption:"caption",items:[{src:"/media/a",kind:"image"},{src:"/media/a",kind:"image"},{src:"/media/b",kind:"video",durationMs:123}]}),copy);
  expect(copy).toHaveBeenCalledTimes(2);
  expect(JSON.parse(result.split("__eclipse_media__:")[1]).items[2]).toEqual({src:"/media/b-new",kind:"video",durationMs:123});
  expect(result).toContain('"caption":"caption"');
 });
 it("copies both audio and artwork without dropping metadata", async () => {
  const copy=vi.fn(async (url:string)=>url+"-new");
  const result=await copyForwardMedia("__eclipse_media__:"+JSON.stringify({type:"music",url:"/media/a",coverUrl:"/media/c",title:"Song",author:"Artist"}),copy);
  expect(copy).toHaveBeenCalledWith("/media/a","audio",undefined,undefined);
  expect(copy).toHaveBeenCalledWith("/media/c","image",undefined,undefined);
  expect(result).toContain('"author":"Artist"');
 });
 it("does not copy normal text or packaged stickers", async () => {
  const copy=vi.fn();expect(await copyForwardMedia("hi",copy)).toBe("hi");
  await copyForwardMedia('__eclipse_media__:{"type":"sticker","src":"/gifs/wink.gif"}',copy);expect(copy).not.toHaveBeenCalled();
 });
 it("forwards story reply text without unrelated story context", async () => {
  expect(await copyForwardMedia('__eclipse_media__:{"type":"story_reply","text":"Nice!"}',vi.fn())).toBe("Nice!");
 });
});
