"use client";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { EMOJI_STATUS_CATALOG } from "@/lib/emoji-status";
import { customEmojiToken } from "@/lib/custom-emoji";
import { InlineEmoji } from "./InlineEmoji";
import { DEFAULT_ANIMATED_EMOJIS } from "@/lib/client/default-animated-emojis";

type Item={value:string;emoji?:string;id?:string;label:string};
const packs: Array<{id:string;title:string;items:Item[]}>= [{id:'default',title:'Default',items:DEFAULT_ANIMATED_EMOJIS.map(emoji=>({value:emoji,emoji,label:emoji}))}];
for(const entry of EMOJI_STATUS_CATALOG){const id=entry.animation.split('/')[2];let pack=packs.find(p=>p.id===id);if(!pack){pack={id,title:entry.packTitle,items:[]};packs.push(pack);}pack.items.push({id:entry.id,value:customEmojiToken(entry.id),label:entry.nameEn});}
const headerHeight=32;
const Cell=memo(function Cell({item,onSelect,left,top,columns,rowHeight}:{item:Item;onSelect:(value:string)=>void;left:number;top:number;columns:number;rowHeight:number}){
 return <button type="button" data-text-emoji={item.id??item.emoji} aria-label={item.label} onMouseDown={event=>event.preventDefault()} onClick={()=>onSelect(item.value)} className="group absolute flex items-center justify-center rounded-full bg-transparent active:scale-90 transition-transform touch-manipulation" style={{left:`${left}%`,width:`${100/columns}%`,height:rowHeight,top}}><span aria-hidden className="absolute size-9 rounded-full transition-colors group-hover:bg-white/[0.08] group-active:bg-white/[0.12]"/><InlineEmoji emoji={item.emoji} id={item.id} size={28}/></button>;
});
export default function TextEmojiPicker({onSelect, mobile=false}:{onSelect:(value:string)=>void;mobile?:boolean}){
 const viewport=useRef<HTMLDivElement>(null),navigation=useRef<HTMLDivElement>(null),[scrollTop,setScrollTop]=useState(0),[height,setHeight]=useState(240),[width,setWidth]=useState(350);const reduced=useReducedMotion();
 const columns=mobile?Math.max(5,Math.min(7,Math.floor(width/44))):7,rowHeight=mobile?44:40;
 const layout=useMemo(()=>{let offset=0;return packs.map(pack=>{const top=offset;offset+=headerHeight+Math.ceil(pack.items.length/columns)*rowHeight;return {...pack,top,bottom:offset};});},[columns,rowHeight]);
 const total=layout.at(-1)!.bottom;const active=layout.findLast(pack=>pack.top<=scrollTop+headerHeight)?.id??'default';
 const frame=useRef<number|null>(null);
 useEffect(()=>{
  const element=viewport.current;if(!element)return;
  const measure=()=>{setHeight(element.clientHeight);setWidth(element.clientWidth);setScrollTop(element.scrollTop);};
  measure();const observer=new ResizeObserver(measure);observer.observe(element);
  return()=>{observer.disconnect();if(frame.current!==null)cancelAnimationFrame(frame.current);};
 },[]);
 useEffect(()=>{
  const bar=navigation.current,button=bar?.querySelector<HTMLElement>('[aria-pressed="true"]');if(!bar||!button)return;
  const a=bar.getBoundingClientRect(),b=button.getBoundingClientRect();
  if(b.left<a.left||b.right>a.right)bar.scrollTo({left:bar.scrollLeft+b.left-a.left-(a.width-b.width)/2,behavior:reduced?'instant':'smooth'});
 },[active,reduced]);
 return <div data-text-emoji-picker className="flex h-full min-h-0 flex-col">
  <div ref={viewport} data-text-emoji-scroll className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-1" onScroll={event=>{const el=event.currentTarget;if(frame.current!==null)return;frame.current=requestAnimationFrame(()=>{frame.current=null;setScrollTop(Math.floor(el.scrollTop/rowHeight)*rowHeight);setHeight(el.clientHeight);});}}>
   <div className="relative" style={{height:total}}>
    {layout.filter(pack=>pack.bottom>scrollTop-rowHeight&&pack.top<scrollTop+height+rowHeight).map(pack=><div key={pack.id}>
     {pack.top>=scrollTop-headerHeight&&<div data-text-emoji-heading={pack.id} className="absolute inset-x-2 flex h-8 items-center text-[12px] font-semibold text-zinc-400" style={{top:pack.top}}>{pack.title}</div>}
     {pack.items.map((item,index)=>({item,index,top:pack.top+headerHeight+Math.floor(index/columns)*rowHeight})).filter(({top})=>top+rowHeight>scrollTop-rowHeight&&top<scrollTop+height+rowHeight).map(({item,index,top})=><Cell key={item.value} item={item} columns={columns} rowHeight={rowHeight} left={index%columns*100/columns} top={top} onSelect={onSelect}/>)}
    </div>)}
   </div>
  </div>
  <div ref={navigation} data-text-emoji-packs className="no-scrollbar mx-2 my-1 flex w-max max-w-[calc(100%-16px)] shrink-0 self-center items-center gap-1 overflow-x-auto rounded-full bg-transparent p-1 text-white shadow-none touch-pan-x" style={{height:mobile?40:36,border:0}} onWheel={event=>{if(Math.abs(event.deltaY)>Math.abs(event.deltaX))event.currentTarget.scrollLeft+=event.deltaY;}}>
   {layout.map(pack=><button key={pack.id} type="button" title={pack.title} aria-label={pack.title} aria-pressed={active===pack.id} onMouseDown={event=>event.preventDefault()} onClick={()=>viewport.current?.scrollTo({top:pack.top,behavior:reduced?'instant':'smooth'})} style={{width:mobile?32:28,height:mobile?32:28}} className={`flex shrink-0 items-center justify-center rounded-full transition-colors touch-manipulation ${active===pack.id?'bg-white/10':'hover:bg-white/[0.06]'}`}><InlineEmoji emoji={pack.items[0].emoji} id={pack.items[0].id} size={22}/></button>)}
  </div>
 </div>;
}
