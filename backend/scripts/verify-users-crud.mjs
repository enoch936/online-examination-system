/**
 * End-to-end CRUD check for the users API (admin-scoped).
 *
 *   create -> read (list + search + status filter) -> update
 *         -> delete a clean account -> confirm gone
 *         -> delete an account with exam history (must be refused)
 *
 *   node scripts/verify-users-crud.mjs <baseUrl> <superEmail> <superPw>
 */
const [base, superEmail, superPw] = process.argv.slice(2);

const token0 = await fetch(`${base}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: superEmail, password: superPw }),
  signal: AbortSignal.timeout(15000),
});
if (token0.status !== 201) {
  console.log(`admin login -> ${token0.status}`);
  process.exit(1);
}
const token = (await token0.json()).data.accessToken;
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const call = async (method, path, body) => {
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: auth,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, data: parsed?.data, error: parsed?.error?.message };
};

const stamp = Date.now();
const email = `crud.check.${stamp}@example.test`;
const pw = 'Str0ng!Passphrase';

// CREATE
const created = await call('POST', '/users', { email, firstName: 'Crud', lastName: 'Check', password: pw, role: 'STUDENT' });
console.log(`create            -> ${created.status} ${created.status < 300 ? created.data?.email : created.error}`);
if (created.status >= 300) process.exit(1);
const id = created.data.id;

// READ (search)
const searched = await call('GET', `/users?q=crud.check.${stamp}`);
console.log(`search "crud"     -> ${searched.status} found=${searched.data?.length}`);
const searchedLower = await call('GET', `/users?q=CRUD.CHECK.${stamp}`);
console.log(`search UPPERCASE  -> ${searchedLower.status} found=${searchedLower.data?.length} (case-insensitive)`);

// READ (role + status filters)
const byRole = await call('GET', '/users?role=STUDENT&status=ACTIVE');
console.log(`filter role+status-> ${byRole.status} count=${byRole.data?.length}`);

// UPDATE
const updated = await call('PATCH', `/users/${id}`, { firstName: 'Renamed', phone: '+251700000001', status: 'SUSPENDED' });
console.log(`update            -> ${updated.status} name=${updated.data?.firstName} status=${updated.data?.status}`);

// DELETE (clean account -> allowed)
const deleted = await call('DELETE', `/users/${id}`);
console.log(`delete (clean)    -> ${deleted.status}`);
const gone = await call('GET', `/users/${id}`);
console.log(`read after delete -> ${gone.status} ${gone.status === 404 ? 'gone OK' : gone.error}`);

// DELETE (account with exam history -> refused, must deactivate instead)
const withHistory = await call('GET', '/users?q=tsdat2121');
const target = withHistory.data?.[0];
const refused = await call('DELETE', `/users/${target.id}`);
console.log(`delete (has exams)-> ${refused.status} "${refused.error}"`);

// DELETE self -> refused
const me = await call('GET', '/users?q=supertsdat');
const self = await call('DELETE', `/users/${me.data?.[0]?.id ?? ''}`);
console.log(`delete self       -> ${self.status} "${self.error ?? ''}"`);

// Permission guard: a plain STUDENT session must not be able to manage users.
const studentLogin = await call('POST', '/auth/login', { email: 'tsdat2121@gmail.com', password: 'TempReset@2026x' });
const studentList = await fetch(`${base}/api/v1/users`, {
  headers: { Authorization: `Bearer ${studentLogin.data?.accessToken ?? ''}` },
  signal: AbortSignal.timeout(15000),
}).catch(() => ({ status: 0 }));
console.log(`student lists users-> ${studentList.status} ${studentList.status === 403 ? 'forbidden OK' : ''}`);

const ok =
  created.status < 300 &&
  (searched.data?.length ?? 0) === 1 &&
  (searchedLower.data?.length ?? 0) === 1 &&
  updated.status === 200 &&
  deleted.status === 200 &&
  gone.status === 404 &&
  refused.status === 400 &&
  self.status === 400;
console.log(ok ? '\nRESULT: OK' : '\nRESULT: FAILED');
process.exit(ok ? 0 : 1);
