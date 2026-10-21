const ts=require('typescript'),fs=require('fs'),path=require('path');const entries=[];
function scan(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,d.name).replaceAll('\\','/');if(d.isDirectory())scan(file);else if(file.endsWith('.tsx')&&!['components/LanguagePicker.tsx','components/LocaleProvider.tsx'].includes(file)){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function walk(n){if((ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isJsxText(n))&&/[А-Яа-яЁё]/.test(n.text)){
 let translated=false;for(let p=n.parent;p;p=p.parent)if(ts.isCallExpression(p)&&['t','translate','localizeSystemText'].includes(p.expression.getText(source)))translated=true;
 if(!translated)entries.push({file,line:source.getLineAndCharacterOfPosition(n.getStart(source)).line+1,text:n.text.trim()});
 }ts.forEachChild(n,walk);}walk(source);
}}}
scan('app');scan('components');fs.writeFileSync('scratch/i18n-unwrapped.json',JSON.stringify(entries,null,2));console.log(entries.map(e=>`${e.file}:${e.line}\t${e.text}`).join('\n'));console.log(entries.length,'unwrapped literals (including metadata, parser tokens and native language names)');
