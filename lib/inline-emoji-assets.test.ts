import { existsSync } from "node:fs";
import { expect, it } from "vitest";
import sharp from "sharp";
import assets from "./client/inline-emoji-assets.json";
import { ALL_AVAILABLE_REACTIONS } from "@/app/app/(chats)/constants";
import { DEFAULT_ANIMATED_EMOJIS } from "./client/default-animated-emojis";
import { getTelegramEmojiGifUrl, TELEGRAM_COMPOSER_EMOJIS } from "./client/telegram-emoji-gifs";

it.skipIf(!existsSync("public"+assets["big-smile.gif"].preview))("keeps padding transparent on every frame of non-square emoji",async()=>{
 for(const [name,axis] of [['big-smile.gif','row'],['thumbs-up.gif','column']] as const){
  const path=(assets as Record<string,{preview:string}>)[name].preview;
  const {data,info}=await sharp('public'+path,{animated:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  expect(info.width).toBe(96);expect(info.height%96).toBe(0);
  for(let frame=0;frame<info.height/96;frame++)for(let p=0;p<96;p++){
   const x=axis==='row'?p:0,y=frame*96+(axis==='row'?0:p);
   expect(data[(y*96+x)*4+3]).toBe(0);
  }
 }
});
it.skipIf(!existsSync("public"+assets["nerd.gif"].large))("provides separate sharp animations for large message emoji",async()=>{
 for(const name of ['nerd.gif','big-smile.gif']){
  const asset=(assets as Record<string,{large?:string;largeStill?:string}>)[name];
  expect(asset.large).toBeTruthy();expect(asset.largeStill).toBeTruthy();
  const meta=await sharp('public'+asset.large,{animated:true}).metadata();
  expect(meta.width).toBe(320);expect(meta.pages).toBeGreaterThan(1);expect(meta.pages).toBeLessThanOrEqual(72);
  expect((await sharp('public'+asset.largeStill).metadata()).width).toBe(320);
 }
});
it("removes the three unavailable reactions without removing animated ones",()=>{
 for(const emoji of ['🤨','🎁','👽'])expect(ALL_AVAILABLE_REACTIONS).not.toContain(emoji);
 for(const emoji of ['❤️','👍','😁'])expect(ALL_AVAILABLE_REACTIONS).toContain(emoji);
});
it.skipIf(!existsSync("public"+assets["big-smile.gif"].preview))("offers only real animations in Default",async()=>{
 expect(DEFAULT_ANIMATED_EMOJIS.length).toBeGreaterThan(0);
 expect(DEFAULT_ANIMATED_EMOJIS.length).toBeLessThan(new Set(TELEGRAM_COMPOSER_EMOJIS).size);
 for(const emoji of DEFAULT_ANIMATED_EMOJIS){
  const filename=getTelegramEmojiGifUrl(emoji)!.split('/').pop()!;
  const asset=(assets as Record<string,{preview:string;animated:boolean}>)[filename];
  expect(asset.animated).toBe(true);
  expect((await sharp('public'+asset.preview,{animated:true}).metadata()).pages).toBeGreaterThan(1);
 }
});
