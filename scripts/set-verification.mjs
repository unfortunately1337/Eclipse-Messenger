import { PrismaClient, Prisma } from '@prisma/client';
process.loadEnvFile('.env');
const [kind, rawLink, value] = process.argv.slice(2);
if (!['user','bot','group','channel'].includes(kind) || !rawLink || !['true','false'].includes(value)) {
  console.error('Usage: node scripts/set-verification.mjs user|bot|group|channel username true|false');process.exit(1);
}
const db=new PrismaClient(),link=rawLink.replace(/^@+/,'').toLowerCase();
try {
  const table=Prisma.raw(kind==='group'?'"Group"':kind==='channel'?'"Channel"':'"User"');
  const bot=kind==='bot'?Prisma.sql`AND "isBot" = true`:Prisma.empty;
  const rows=await db.$queryRaw`UPDATE ${table} SET "isVerified" = ${value==='true'}, "updatedAt" = NOW() WHERE lower("link") = ${link} ${bot} RETURNING "id", "link", "isVerified"`;
  if(rows.length!==1)throw new Error('Entity not found; no verification changed.');
  console.log(JSON.stringify(rows[0]));
}finally{await db.$disconnect();}
