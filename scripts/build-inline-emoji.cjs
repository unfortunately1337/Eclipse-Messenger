const fs = require('node:fs/promises');
const sharp = require('sharp');
sharp.cache({files:0});
async function render(input,meta,size,intervalMs,preview,still){
 const {data,info}=await sharp(input,{animated:true}).resize({width:size,height:size,fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const pages=meta.pages||1,height=info.height/pages,bytes=info.width*height*info.channels;
 const total=(meta.delay||[100]).reduce((a,b)=>a+b,0),interval=Math.max(intervalMs,total/72);
 let elapsed=0,first=0;const frames=[],delays=[];
 for(let i=0;i<pages;i++){elapsed+=meta.delay?.[i]||100;if(elapsed>=interval||i===pages-1){frames.push(data.subarray(first*bytes,(first+1)*bytes));delays.push(elapsed);elapsed=0;first=i+1;}}
 await sharp(frames[0],{raw:{width:size,height:size,channels:4}}).webp({quality:90,alphaQuality:100}).toFile('public'+still);
 await sharp(Buffer.concat(frames),{raw:{width:size,height:size*frames.length,channels:4,pageHeight:size}}).webp({quality:86,alphaQuality:100,effort:3,delay:delays,loop:0}).toFile('public'+preview);
 return frames.length>1&&frames.some(frame=>!frame.equals(frames[0]));
}
async function main(){
 const source=await fs.readFile('lib/client/telegram-emoji-gifs.ts','utf8');
 const names=[...new Set([...source.split('export const BUNDLED_STATIC_GIFS')[0].matchAll(/: "([^"\n]+\.gif)"/g)].map(m=>m[1]))];
 const manifest={};let next=0,done=0;
 await Promise.all(Array.from({length:2},async()=>{while(next<names.length){
  const name=names[next++];let input;
  for(const dir of ['public/gifs','.cache/emoji-gifs']){try{await fs.access(`${dir}/${name}`);input=`${dir}/${name}`;break;}catch{}}
  if(!input)throw Error('Missing GIF '+name);
  const meta=await sharp(input,{animated:true}).metadata();
  const stem=name.replace(/\.gif$/,'');
  const preview=`/emoji-picker/${stem}.inline-hq-v1.webp`,still=`/emoji-picker/${stem}.still-hq-v1.webp`;
  const large=`/emoji-picker/${stem}.large-hq-v1.webp`,largeStill=`/emoji-picker/${stem}.large-still-hq-v1.webp`;
  const animated=await render(input,meta,96,84,preview,still);
  await render(input,meta,320,56,large,largeStill);
  manifest[name]={preview,still,large,largeStill,animated};
  if(++done%25===0)console.log(`Built ${done}/${names.length} high-resolution emoji`);
 }}));
 await fs.writeFile('lib/client/inline-emoji-assets.json',JSON.stringify(manifest,null,2)+'\n');console.log('Built',names.length,'inline animations');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
