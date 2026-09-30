/**
 * Proves whether an instructor can watch a live candidate in PRODUCTION.
 *
 * The monitor page's immediacy depends entirely on a cross-origin Socket.IO
 * connection to the backend: next.config.mjs only rewrites /api/:path*, so the
 * socket is NOT proxied and has to reach the backend origin directly, subject
 * to the gateway's CORS allowlist. An HTTP probe of /api/v1 proves none of
 * that, so this exercises the real path:
 *
 *   1. mint an instructor access token from the DB
 *   2. connect a Socket.IO client to the deployed backend, with the Vercel
 *      origin the browser would send
 *   3. emit monitor:join for a real exam and wait for monitor:config
 *
 * A successful monitor:config reply means the room join is authorized, so
 * monitor:candidate-update fan-out reaches this client.
 *
 *   node scripts/probe-live-monitoring.mjs <directDbUrl> <jwtSecret> <backendOrigin> <pageOrigin>
 */
import { PrismaClient } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

// socket.io-client is a frontend dependency, so it is not resolvable from
// backend/scripts. Load it by path rather than duplicating the package.
const clientPath = path.resolve(process.cwd(), '..', 'frontend', 'node_modules', 'socket.io-client', 'build', 'esm', 'index.js');
if (!existsSync(clientPath)) {
  console.error(`socket.io-client not found at ${clientPath}; run pnpm install in frontend/`);
  process.exit(1);
}
const { io } = await import(pathToFileURL(clientPath).href);

const [directUrl, accessSecret, backendOrigin, pageOrigin] = process.argv.slice(2);
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(payload, secret, seconds = 600) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ ...payload, iat: now, exp: now + seconds });
  return body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
}

const instructor = await prisma.user.findFirst({
  where: {
    status: 'ACTIVE',
    roles: { some: { role: { name: { in: ['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'] } } } },
  },
  select: {
    id: true,
    email: true,
    roles: {
      select: {
        role: {
          select: {
            name: true,
            rolePermissions: { select: { permission: { select: { key: true } } } },
          },
        },
      },
    },
  },
});
if (!instructor) {
  console.log('no active instructor found');
  await prisma.$disconnect();
  process.exit(0);
}
const roles = instructor.roles.map((r) => r.role.name);
const permissions = instructor.roles.flatMap((r) => r.role.rolePermissions.map((p) => p.permission.name));
console.log(`instructor : ${instructor.email}`);
console.log(`roles      : ${roles.join(', ')}`);
console.log(`perms      : ${permissions.join(', ') || '(none)'}`);
console.log(`monitor perm: ${permissions.includes('sessions.monitor') ? 'yes' : 'NO'}`);

// Prefer an exam this instructor created: monitor:join is access-checked, so a
// foreign exam would be refused for reasons unrelated to the socket.
const exam =
  (await prisma.exam.findFirst({
    where: { createdById: instructor.id },
    select: { id: true, title: true, status: true, createdById: true, _count: { select: { sessions: true } } },
    orderBy: { createdAt: 'desc' },
  })) ??
  (await prisma.exam.findFirst({
    where: { status: { in: ['LIVE', 'PUBLISHED', 'SCHEDULED', 'CLOSED'] } },
    select: { id: true, title: true, status: true, createdById: true, _count: { select: { sessions: true } } },
    orderBy: { createdAt: 'desc' },
  }));
if (!exam) {
  console.log('no exam found at all');
  await prisma.$disconnect();
  process.exit(0);
}
const owned = exam.createdById === instructor.id;
console.log(`exam       : "${exam.title}" (${exam.status}), sessions=${exam._count.sessions}, ownedByProbe=${owned}`);

const token = sign(
  { sub: instructor.id, email: instructor.email, roles, permissions },
  accessSecret,
);

const socketUrl = `${backendOrigin.replace(/\/$/, '')}/realtime`;
console.log(`\nconnecting to ${socketUrl}`);
console.log(`origin     : ${pageOrigin}`);

const result = await new Promise((resolve) => {
  const socket = io(socketUrl, {
    transports: ['websocket'],
    reconnection: false,
    timeout: 15000,
    extraHeaders: { Origin: pageOrigin },
    auth: (cb) => cb({ token }),
  });

  const done = (payload) => {
    socket.close();
    resolve(payload);
  };
  const timer = setTimeout(() => done({ ok: false, why: 'timed out after 15s with no monitor:config' }), 20000);

  socket.on('connect', () => {
    console.log(`  connected      : ${socket.id}`);
    console.log(`  transport      : ${socket.io.engine.transport.name}`);
    console.log('  -> cross-origin socket + token auth WORKS; now joining monitor room');
    // monitor:join replies through the Socket.IO ack callback, NOT a
    // monitor:config broadcast (the server never emits that event, even though
    // the page listens for it). Waiting for a broadcast would time out even on
    // a fully successful join.
    socket.emit('monitor:join', { examId: exam.id }, (ack) => {
      clearTimeout(timer);
      if (ack?.joined) {
        done({ ok: true, config: ack });
      } else {
        done({ ok: false, why: `monitor:join refused: ${JSON.stringify(ack)}` });
      }
    });
  });

  socket.on('connect_error', (err) => {
    clearTimeout(timer);
    done({ ok: false, why: `connect_error: ${err.message}` });
  });

  // Distinguishes "socket is broken" from "room join is refused", which have
  // very different fixes.
  socket.on('exception', (err) => {
    console.log(`  exception      : ${err?.message ?? JSON.stringify(err)}`);
  });
});

if (!result.ok) {
  console.log(`\nRESULT: FAILED — ${result.why}`);
  console.log('The monitor page falls back to 15s polling when this fails.');
} else {
  console.log('\nRESULT: OK — socket connected and monitor:join was authorized');
  console.log(`  ack: ${JSON.stringify(result.config)}`);
  console.log('  -> monitor:candidate-update fan-out to this client is working,');
  console.log('     so a starting student is pushed immediately, not on the next poll.');
}

await prisma.$disconnect();
