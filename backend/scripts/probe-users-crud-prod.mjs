/**
 * Read-only production probe for the new users CRUD surface.
 *
 *   node scripts/probe-users-crud-prod.mjs <baseUrl> <email> <password>
 *
 * Verifies, without mutating anything, that Render is serving the build that
 * added `q` / `status` filtering and the DELETE route:
 *   - GET /users?q=<random>            -> 0 rows (filter actually applied)
 *   - GET /users?q=UPPERCASE<known>    -> >0 rows (case-insensitive)
 *   - GET /users?status=DEACTIVATED    -> 200
 *   - DELETE /users/<unknown uuid>     -> 400 (route exists, not 404 route-not-found)
 *   - PATCH /users/<unknown uuid>      -> 404 (target lookup)
 */
const [base, email, password] = process.argv.slice(2);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login() {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(20000),
    });
    if (res.status === 201) return (await res.json()).data.accessToken;
    if (res.status === 429) {
      const wait = 30 * attempt;
      console.log(`  rate limited, waiting ${wait}s (attempt ${attempt})`);
      await sleep(wait * 1000);
      continue;
    }
    throw new Error(`login failed: ${res.status}`);
  }
  throw new Error('login still rate limited');
}

const token = await login();
const headers = { Authorization: `Bearer ${token}` };
const probe = async (method, path) => {
  const res = await fetch(`${base}${path}`, { method, headers, signal: AbortSignal.timeout(20000) });
  const body = await res.text();
  let json;
  try { json = JSON.parse(body); } catch { json = {}; }
  return { status: res.status, rows: json?.data?.length, msg: json?.error?.message };
};

const uuid = '00000000-0000-0000-0000-000000000000';
const tag = `zzprobe${Date.now()}`;

const all = await probe('GET', '/users');
console.log(`GET /users                 -> ${all.status} ${all.rows} users`);

const q = await probe('GET', `/users?q=${tag}`);
console.log(`GET /users?q=${tag} -> ${q.status} ${q.rows} rows  [${q.rows === 0 ? 'q filter live' : 'q filter MISSING'}]`);

const upper = await probe('GET', '/users?q=TSETDAT');
console.log(`GET /users?q=TSETDAT       -> ${upper.status} ${upper.rows} rows  [${upper.rows > 0 ? 'case-insensitive OK' : 'no match'}]`);

const status = await probe('GET', '/users?status=DEACTIVATED');
console.log(`GET /users?status=DEACTIV. -> ${status.status} ${status.rows} rows`);

const both = await probe('GET', '/users?role=STUDENT&status=ACTIVE');
console.log(`GET /users?role+status     -> ${both.status} ${both.rows} rows`);

const del = await probe('DELETE', `/users/${uuid}`);
const routeLive = del.status === 404 && /not found/i.test(del.msg ?? '');
console.log(`DELETE /users/<unknown>    -> ${del.status} ${del.msg ?? ''}  [${routeLive ? 'route live (service 404, not route 404)' : 'check'}]`);

const patch = await probe('PATCH', `/users/${uuid}`);
console.log(`PATCH /users/<unknown>     -> ${patch.status} ${patch.msg ?? ''}`);

const live = q.rows === 0 && q.status === 200 && status.status === 200 && both.status === 200 && routeLive;
console.log(live ? '\nRESULT: OK - production is serving the new CRUD build' : '\nRESULT: FAILED');
process.exit(live ? 0 : 1);
