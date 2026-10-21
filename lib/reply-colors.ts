type RGB = readonly [number,number,number];
function rgb(value: string): RGB | null {
  if(/^#[a-f\d]{3}$/i.test(value)) return [...value.slice(1)].map(n=>parseInt(n+n,16)) as unknown as RGB;
  if(/^#[a-f\d]{6,8}$/i.test(value)) return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16)) as unknown as RGB;
  const channels=value.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/i);
  return channels ? [Number(channels[1]),Number(channels[2]),Number(channels[3])] : null;
}
function luminance(color: RGB){const c=color.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
const contrast=(a:RGB,b:RGB)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
const hex=(color:RGB)=>'#'+color.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
/** Match the bubble's hue while keeping the reply rule distinct from its surface. */
export function getReplyLineColor(surface: string, preferred?: string): string {
  const colors=(surface.match(/#[\da-f]{3,8}\b|rgba?\([^)]*\)/gi)??[]).map(rgb).filter((c):c is RGB=>c!==null);
  if(!colors.length)colors.push([33,33,33]);
  const requested=preferred?rgb(preferred):null;
  if(requested&&colors.every(color=>contrast(color,requested)>=2.3))return preferred!;
  const base=colors[0],light=colors.reduce((sum,c)=>sum+luminance(c),0)/colors.length>.6;
  const neutral=Math.max(...base)-Math.min(...base)<24;
  let result:RGB=neutral?(light?[156,163,175]:[228,228,231]):base.map(c=>light?c*.35:c*.2+255*.8) as unknown as RGB;
  if(!colors.every(color=>contrast(color,result)>=2.3)){
    const candidates:RGB[]=[result,[100,107,119],[156,163,175],[228,228,231],[255,255,255],[64,64,67],[0,0,0]];
    const score=(candidate:RGB)=>Math.min(...colors.map(color=>contrast(color,candidate)));
    result=candidates.reduce((best,candidate)=>score(candidate)>score(best)?candidate:best);
  }
  return hex(result);
}
