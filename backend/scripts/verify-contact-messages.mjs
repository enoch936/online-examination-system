/**
 * End-to-end check for the contact-message pipeline.
 *
 *   public form -> staff inbox -> triage (read / resolve) -> permission split
 *
 *   node scripts/verify-contact-messages.mjs <baseUrl> <superEmail> <superPw>
 */
const [base, superEmail, superPw] = process.argv.slice(2);

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = {}; }
  return { status: res.status, data: json?.data, pagination: json?.data?.pagination, msg: json?.error?.message, body: json };
}

async function login(email, password) {
  const res = await call('/auth/login', { method: 'POST', body: { email, password } });
  return res.status === 201 ? res.data.accessToken : null;
}

const stamp = Date.now();
const subject = `pipeline check ${stamp}`;

console.log('\n1. Public contact form (no session)');
const created = await call('/contact', {
  method: 'POST',
  body: { name: 'Ada Lovelace', email: `ada.${stamp}@example.test`, message: `Enquiry about ${subject} — please advise on rollout.` },
});
check('POST /contact is public and accepts the message', created.status === 201, `status ${created.status}`);
check('it is filed as NEW', created.data?.status === 'NEW');
const id = created.data?.id;
check('the response never leaks an internal field', created.data && !('passwordHash' in created.data));

console.log('\n2. Validation still rejects junk');
const bad = await call('/contact', { method: 'POST', body: { name: '', email: 'not-an-email', message: '' } });
check('invalid payload is rejected', bad.status === 400, `status ${bad.status}`);

console.log('\n3. Administrator inbox');
const adminToken = await login(superEmail, superPw);
check('admin can sign in', Boolean(adminToken));
const list = await call('/contact', { token: adminToken });
const rows = (r) => r.data?.data ?? [];
check('GET /contact lists the message', list.status === 200 && rows(list).some((m) => m.id === id));
check('response is paginated', typeof list.pagination?.totalPages === 'number', `total ${list.pagination?.total}, page ${list.pagination?.page}`);
check('per-status counts are included', typeof list.pagination?.counts?.NEW === 'number', JSON.stringify(list.pagination?.counts));

const searched = await call(`/contact?q=${encodeURIComponent(subject)}`, { token: adminToken });
check('search finds the message by body text', rows(searched).length === 1, `${rows(searched).length} match`);

const caseFolded = await call(`/contact?q=${encodeURIComponent(subject.toUpperCase())}`, { token: adminToken });
check('search is case-insensitive', rows(caseFolded).length === 1, `${rows(caseFolded).length} match`);

const filteredNew = await call('/contact?status=NEW', { token: adminToken });
check('status filter returns only NEW', rows(filteredNew).every((m) => m.status === 'NEW'));

const paged = await call('/contact?page=1&limit=1', { token: adminToken });
check('pagination honours limit', rows(paged).length === 1, `${rows(paged).length} row(s)`);

const one = await call(`/contact/${id}`, { token: adminToken });
check('GET /contact/:id opens the message', one.status === 200 && one.data?.id === id);

console.log('\n4. Triage');
const read = await call(`/contact/${id}/status`, { token: adminToken, method: 'PATCH', body: { status: 'READ' } });
check('mark as read', read.status === 200 && read.data?.status === 'READ');
const resolved = await call(`/contact/${id}/status`, { token: adminToken, method: 'PATCH', body: { status: 'RESOLVED' } });
check('mark as resolved', resolved.status === 200 && resolved.data?.status === 'RESOLVED');
const reopened = await call(`/contact/${id}/status`, { token: adminToken, method: 'PATCH', body: { status: 'NEW' } });
check('reopen returns it to the queue', reopened.status === 200 && reopened.data?.status === 'NEW');

const badStatus = await call(`/contact/${id}/status`, { token: adminToken, method: 'PATCH', body: { status: 'ARCHIVED' } });
check('an unknown status is rejected', badStatus.status === 400, `status ${badStatus.status}`);

const missing = await call('/contact/00000000-0000-0000-0000-000000000000/status', { token: adminToken, method: 'PATCH', body: { status: 'READ' } });
check('unknown id is a 404', missing.status === 404, `status ${missing.status}`);

console.log('\n5. Permission split (read vs manage)');
const mk = async (role) => {
  const r = await call('/users', {
    token: adminToken,
    method: 'POST',
    body: { email: `perm.${role}.${stamp}@example.test`, firstName: 'Perm', lastName: 'Check', password: 'Str0ng!Passphrase', role },
  });
  return r.data?.id;
};
const instructorId = await mk('INSTRUCTOR');
const studentId = await mk('STUDENT');
check('created an instructor and a student fixture', Boolean(instructorId && studentId));

const instructorToken = await login(`perm.INSTRUCTOR.${stamp}@example.test`, 'Str0ng!Passphrase');
check('instructor can sign in', Boolean(instructorToken));
const instructorList = await call('/contact', { token: instructorToken });
check('instructor CAN read the inbox (contact.read)', instructorList.status === 200, `status ${instructorList.status}`);
const instructorTriage = await call(`/contact/${id}/status`, { token: instructorToken, method: 'PATCH', body: { status: 'READ' } });
check('instructor CANNOT triage (contact.manage)', instructorTriage.status === 403, `status ${instructorTriage.status}`);

const studentToken = await login(`perm.STUDENT.${stamp}@example.test`, 'Str0ng!Passphrase');
check('student can sign in', Boolean(studentToken));
const studentList = await call('/contact', { token: studentToken });
check('student CANNOT read the inbox', studentList.status === 403, `status ${studentList.status}`);
const studentTriage = await call(`/contact/${id}/status`, { token: studentToken, method: 'PATCH', body: { status: 'READ' } });
check('student CANNOT triage', studentTriage.status === 403, `status ${studentTriage.status}`);

const anonList = await call('/contact');
check('signed-out request is rejected', anonList.status === 401, `status ${anonList.status}`);

console.log('\n6. Cleanup');
for (const fixture of [instructorId, studentId]) {
  const del = await call(`/users/${fixture}`, { token: adminToken, method: 'DELETE' });
  check(`deleted fixture ${fixture.slice(0, 8)}…`, del.status === 200 || del.status === 400, `status ${del.status}`);
}

console.log(failures === 0 ? '\nRESULT: OK' : `\nRESULT: FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
