/**
 * Prints the JSON types the certificates endpoint actually puts on the wire.
 *
 * Prisma maps PostgreSQL `numeric` to Decimal, and JSON.stringify renders a
 * Decimal as a STRING. Any client that calls `.toFixed()` / arithmetic on it
 * therefore throws at runtime, so the wire type has to be asserted rather than
 * assumed from the TypeScript type.
 *
 *   node scripts/check-certificate-wire-types.mjs <directDbUrl> <jwtSecret> <baseUrl>
 */
import { PrismaClient } from '@prisma/client';
import { createHmac } from 'node:crypto';

const [directUrl, accessSecret, base] = process.argv.slice(2);
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(payload, secret) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ ...payload, iat: now, exp: now + 900 });
  return body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
}

const user = await prisma.user.findFirst({ where: { email: 'enoch3696@gmail.com' }, select: { id: true } });
const res = await fetch(`${base}/api/v1/certificates?limit=100`, {
  headers: { Authorization: 'Bearer ' + sign({ sub: user.id, email: 'enoch3696@gmail.com', roles: ['STUDENT'], permissions: [] }, accessSecret) },
});
const json = await res.json();
const result = json?.data?.data?.[0]?.result;
if (!result) {
  console.log(`no certificate on the wire (status ${res.status})`);
} else {
  for (const field of ['score', 'maxScore', 'percentage']) {
    const value = result[field];
    const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    const safe = kind === 'number' ? value.toFixed(2) : JSON.stringify(value);
    console.log(`  result.${field.padEnd(11)} type=${kind.padEnd(7)} value=${safe}  toFixed=${typeof value?.toFixed}`);
  }
}
await prisma.$disconnect();
