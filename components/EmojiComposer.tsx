"use client";
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type FocusEventHandler, type KeyboardEventHandler } from "react";
import { useReducedMotion } from "framer-motion";
import { splitCustomEmoji, emojiPlainText } from "@/lib/custom-emoji";
import { getEmojiStatus } from "@/lib/emoji-status";
import { getTelegramEmojiGifUrl } from "@/lib/client/telegram-emoji-gifs";
import assets from "@/lib/client/inline-emoji-assets.json";
import { watchAnimationVisibility } from "@/lib/client/use-animation-visibility";
import { EMOJI_CLIPBOARD_TYPE as MIME, emojiClipboardHtml, readEmojiClipboard } from "@/lib/client/emoji-clipboard";

const segmenter = new Intl.Segmenter("en", {granularity:"grapheme"});
const isEmoji = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]|\u20E3/u;
function read(node: Node): string {
  if(node.nodeType===Node.TEXT_NODE)return node.textContent??"";
  if(node instanceof HTMLElement){if(node.dataset.editorTrailing!==undefined)return '';if(node.dataset.emojiToken!==undefined)return node.dataset.emojiToken;if(node.tagName==='BR')return '\n';}
  return Array.from(node.childNodes).map((child,index)=>{
    const block=child instanceof HTMLElement && /^(DIV|P)$/.test(child.tagName);
    return (block&&index>0?'\n':'')+read(child);
  }).join('');
}
function offsets(root: HTMLElement) {
  const selection=window.getSelection();if(!selection?.rangeCount||!root.contains(selection.anchorNode)||!root.contains(selection.focusNode))return null;
  const range=selection.getRangeAt(0),start=range.cloneRange();start.selectNodeContents(root);start.setEnd(range.startContainer,range.startOffset);
  const end=range.cloneRange();end.selectNodeContents(root);end.setEnd(range.endContainer,range.endOffset);
  return [read(start.cloneContents()).length,read(end.cloneContents()).length] as const;
}
function rangeAtOffsets(root: HTMLElement, start: number, end = start) {
  const points: Array<{node:Node;offset:number;position:number}>=[];let position=0;
  for(const node of root.childNodes){
    if(node.nodeType===Node.TEXT_NODE){for(let offset=0;offset<=(node.textContent?.length??0);offset++)points.push({node,offset,position:position+offset});position+=node.textContent?.length??0;}
    else {const index=Array.prototype.indexOf.call(root.childNodes,node);points.push({node:root,offset:index,position});position+=read(node).length;points.push({node:root,offset:index+1,position});}
  }
  if(!points.length)points.push({node:root,offset:0,position:0});
  const nearest=(target:number)=>points.reduce((best,p)=>Math.abs(p.position-target)<Math.abs(best.position-target)?p:best);
  const a=nearest(start),b=nearest(end),range=document.createRange();range.setStart(a.node,a.offset);range.setEnd(b.node,b.offset);return range;
}
function restore(root: HTMLElement, start: number, end = start) {
  const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(rangeAtOffsets(root,start,end));
}
export type EmojiComposerHandle = { focus:(options?:FocusOptions)=>void;blur:()=>void;setSelectionRange:(start:number,end:number)=>void;insertText:(text:string,focus?:boolean)=>void;style:CSSStyleDeclaration;scrollHeight:number };
export const EmojiComposer=forwardRef<EmojiComposerHandle,{value:string;onValueChange:(value:string)=>void;placeholder?:string;className?:string;"aria-label"?:string;onFocus?:FocusEventHandler<HTMLDivElement>;onKeyDown?:KeyboardEventHandler<HTMLDivElement>}>(function EmojiComposer({value,onValueChange,placeholder,className,onFocus,onKeyDown,...props},ref){
 const host=useRef<HTMLDivElement>(null),saved=useRef<readonly[number,number]|null>(null),composing=useRef(false),cleanups=useRef(new Map<Element,()=>void>());const reduced=useReducedMotion();
 const insert=(text:string,focus=true)=>{
  const root=host.current;if(!root)return;
  const [start,end]=(focus?offsets(root)??saved.current:saved.current??offsets(root))??[value.length,value.length];
  if(focus)root.focus({preventScroll:true});
  if(focus)restore(root,start,end);
  // Setting the document selection in a blurred contenteditable opens the mobile keyboard.
  const range=focus?window.getSelection()?.getRangeAt(0):rangeAtOffsets(root,start,end);
  if(range){range.deleteContents();range.insertNode(document.createTextNode(text));}
  saved.current=[start+text.length,start+text.length];onValueChange(value.slice(0,start)+text+value.slice(end));
 };
 useImperativeHandle(ref,()=>({focus:(options)=>{host.current?.focus(options);if(saved.current&&host.current)restore(host.current,...saved.current);},blur:()=>host.current?.blur(),setSelectionRange:(start,end)=>{saved.current=[start,end];if(host.current)restore(host.current,start,end);},insertText:insert,get style(){return host.current!.style;},get scrollHeight(){return host.current?.scrollHeight??0;}}));
 useLayoutEffect(()=>{
  const root=host.current;if(!root||composing.current)return;
  let changed=false;
  if(read(root)!==value||root.querySelector(':scope > div, :scope > p')){root.replaceChildren(document.createTextNode(value));changed=true;}
  for(const [element,cleanup] of cleanups.current)if(!root.contains(element)){cleanup();cleanups.current.delete(element);}
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:node=>node.parentElement?.closest('[data-emoji-token]')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  const nodes:Text[]=[];while(walker.nextNode())nodes.push(walker.currentNode as Text);
  for(const node of nodes){
   const source=node.data;if(!source.includes('\n')&&!isEmoji.test(source)&&!splitCustomEmoji(source).some(part=>part.id))continue;
   changed=true;const fragment=document.createDocumentFragment();let plain='';
   const flush=()=>{if(plain){const lines=plain.split('\n');lines.forEach((line,index)=>{if(index){const br=document.createElement('br');br.dataset.editorNewline='true';fragment.append(br);}if(line)fragment.append(document.createTextNode(line));});plain='';}};
   for(const part of splitCustomEmoji(source))for(const token of part.id?[{segment:part.text}]:segmenter.segment(part.text)){
   const text=token.segment,entry=part.id?getEmojiStatus(part.id):null;
   if(!entry&&!isEmoji.test(text)){plain+=text;continue;}
   flush();const span=document.createElement('span');span.contentEditable='false';span.dataset.emojiToken=text;span.dataset.composerEmoji=entry?.id??text;span.className='inline-block mx-[0.025em]';span.style.cssText='width:1.125em;height:1.125em;vertical-align:-.125em;user-select:all;line-height:1;';
   const filename=getTelegramEmojiGifUrl(text)?.split('/').pop(),asset=filename?(assets as Record<string,{preview:string;still:string}>)[filename]:null;
   const still=entry?.thumbnail??asset?.still,animation=entry?.preview??asset?.preview;
   if(still&&animation){const img=document.createElement('img');img.alt=entry?.emoji??text;img.draggable=false;img.decoding='async';img.src=still;img.style.cssText='width:100%;height:100%;object-fit:contain;display:block;';if(entry?.adaptive)img.style.filter='brightness(0) invert(1)';span.append(img);fragment.append(span);cleanups.current.set(span,watchAnimationVisibility(span,visible=>{const src=visible&&!reduced?animation:still;if(img.getAttribute('src')!==src)img.src=src;span.dataset.emojiPlaying=String(visible&&!reduced);}));}
   else {span.textContent=entry?.emoji??text;fragment.append(span);cleanups.current.set(span,watchAnimationVisibility(span,visible=>span.classList.toggle('animate-emoji-idle',visible&&!reduced)));}
   }
   flush();node.replaceWith(fragment);
  }
  const trailing=root.querySelector('[data-editor-trailing]');
  if(value.endsWith('\n')&&!trailing){const br=document.createElement('br');br.dataset.editorTrailing='true';root.append(br);changed=true;}
  else if(!value.endsWith('\n')&&trailing){trailing.remove();changed=true;}
  if(document.activeElement===root&&saved.current&&(changed||offsets(root)?.[0]!==saved.current[0]))restore(root,...saved.current);
 },[value,reduced]);
 useLayoutEffect(()=>()=>cleanups.current.forEach(fn=>fn()),[]);
 const change=()=>{const root=host.current;if(!root||composing.current)return;if(root.childNodes.length===1&&root.firstChild instanceof HTMLBRElement&&!root.firstChild.dataset.editorNewline){root.replaceChildren();}saved.current=offsets(root);onValueChange(read(root));};
 return <div {...props} ref={host} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={props['aria-label']??placeholder} data-emoji-composer data-placeholder={placeholder} className={className+' whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400'} style={{caretColor:'white',minHeight:20,paddingBlock:'var(--composer-editor-padding, 8px)'}}
  onInput={change} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;change();}}
  onFocus={onFocus} onBlur={()=>{if(host.current)saved.current=offsets(host.current)??saved.current;}} onKeyUp={()=>{if(host.current)saved.current=offsets(host.current)??saved.current;}} onMouseUp={()=>{if(host.current)saved.current=offsets(host.current)??saved.current;}}
  onKeyDown={event=>{onKeyDown?.(event);if(event.key==='Enter'&&!event.defaultPrevented&&!event.nativeEvent.isComposing){event.preventDefault();if(host.current)saved.current=offsets(host.current);insert('\n');}}}
  onCopy={event=>{const root=host.current;if(!root)return;const range=offsets(root);if(!range)return;const text=read(root).slice(...range);event.clipboardData.setData('text/plain',emojiPlainText(text));event.clipboardData.setData(MIME,text);event.clipboardData.setData('text/html',emojiClipboardHtml(text));event.preventDefault();}}
  onCut={event=>{const root=host.current;if(!root)return;const range=offsets(root);if(!range)return;const text=read(root).slice(...range);event.clipboardData.setData('text/plain',emojiPlainText(text));event.clipboardData.setData(MIME,text);event.clipboardData.setData('text/html',emojiClipboardHtml(text));event.preventDefault();saved.current=range;insert('');}}
  onPaste={event=>{event.preventDefault();if(host.current)saved.current=offsets(host.current)??saved.current;insert(readEmojiClipboard(event.clipboardData));}} />;
});
