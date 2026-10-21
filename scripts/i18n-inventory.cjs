const ts=require('typescript'),fs=require('fs'),path=require('path');
const entries=new Map();
const cyrillic=/[А-Яа-яЁё]/;
function add(text,file,line,kind){text=text.replace(/\s+/g,' ').trim();if(!cyrillic.test(text))return;const e=entries.get(text)||{text,uses:[]};e.uses.push({file,line,kind});entries.set(text,e);}
function scan(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,d.name);if(d.isDirectory())scan(f);else if(/\.(tsx?|jsx?)$/.test(f)&&!/(?:\.test\.|\.spec\.|\.d\.ts$)/.test(f)){
 const source=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true,f.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 function walk(n){const line=source.getLineAndCharacterOfPosition(n.getStart(source)).line+1;
  if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isJsxText(n))add(n.text,f,line,ts.SyntaxKind[n.kind]);
  if(ts.isTemplateExpression(n)){let text=n.head.text;n.templateSpans.forEach((s,i)=>text+=`{${i}}`+s.literal.text);add(text,f,line,'Template');}
  ts.forEachChild(n,walk);
 }walk(source);
}}}
for(const dir of ['app','components','lib','hooks'])if(fs.existsSync(dir))scan(dir);
const data=[...entries.values()].sort((a,b)=>a.text.localeCompare(b.text,'ru'));
fs.mkdirSync('scratch',{recursive:true});fs.writeFileSync('scratch/i18n-inventory.json',JSON.stringify(data,null,2));
fs.writeFileSync('scratch/i18n-source.txt',data.map((e,i)=>`${i}\t${e.text}`).join('\n'));
console.log(JSON.stringify({unique:data.length,client:data.filter(e=>e.uses.some(u=>!u.file.includes('server')&&!u.file.includes('api\\'))).length,words:data.reduce((n,e)=>n+e.text.split(' ').length,0)}));
