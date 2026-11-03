// The classic service worker and foreground notifications use the same formatter.
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync('lib/message-notification-preview.ts', 'utf8').replace('export function', 'function');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText.trim();
const file = 'public/service-worker.js';
const original = fs.readFileSync(file, 'utf8');
const start = '// BEGIN notification preview (generated)';
const end = '// END notification preview (generated)';
const generated = `${start}\n${code}\n${end}\n`;
const next = original.includes(start) ? original.slice(0, original.indexOf(start)) + generated + original.slice(original.indexOf(end) + end.length).replace(/^\r?\n/, '') : generated + original;
if (next !== original) fs.writeFileSync(file, next);
