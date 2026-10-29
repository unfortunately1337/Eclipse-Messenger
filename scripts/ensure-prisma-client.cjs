const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const project = path.resolve(__dirname, '..');
const normalizeSchema = (text) => text.replace(/\r\n/g, '\n').trim();

function clientIsCurrent(root = project, platform = process.platform) {
  try {
    const client = path.join(root, 'node_modules', '.prisma', 'client');
    const schema = fs.readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8');
    const generated = fs.readFileSync(path.join(client, 'schema.prisma'), 'utf8');
    if (normalizeSchema(schema) !== normalizeSchema(generated)) return false;
    const installed = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', '@prisma', 'client', 'package.json'), 'utf8')).version;
    const source = fs.readFileSync(path.join(client, 'index.js'), 'utf8');
    const version = source.match(/Prisma\.prismaVersion\s*=\s*\{\s*client:\s*"([^"]+)"/);
    if (!version || version[1] !== installed || !fs.existsSync(path.join(client, 'index.d.ts')) || !fs.existsSync(path.join(client, 'default.js'))) return false;
    return fs.readdirSync(client).some(name => {
      const native = platform === 'win32' ? name === 'query_engine-windows.dll.node'
        : platform === 'darwin' ? /^libquery_engine-darwin.*\.dylib\.node$/.test(name)
        : /^libquery_engine-.*\.so\.node$/.test(name);
      return native && fs.statSync(path.join(client, name)).size > 0;
    });
  } catch { return false; }
}

if (require.main === module) {
  if (clientIsCurrent()) {
    console.log('Prisma Client is up to date. Skipping generation.');
  } else {
    console.log('Generating Prisma Client for the current schema...');
    const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'generate'], { cwd: project, stdio: 'inherit' });
    if (result.error) console.error(result.error.message);
    if (result.status !== 0 || result.error) {
      console.error('If Windows reports EPERM for the Prisma engine, close running Eclipse servers and Prisma Studio, then retry.');
      process.exitCode = result.status || 1;
    }
  }
}

module.exports = { clientIsCurrent };
