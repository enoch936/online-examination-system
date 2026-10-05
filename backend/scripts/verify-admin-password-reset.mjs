/**
 * End-to-end check of the admin password reset:
 *   1. log in as SUPER_ADMIN
 *   2. PATCH /users/:id/password for a student
 *   3. log in as that student with the new password
 *
 *   node scripts/verify-admin-password-reset.mjs <baseUrl> <superEmail> <superPw> <studentEmail> <newPw>
 */
const [base, superEmail, superPw, studentEmail, newPw] = process.argv.slice(2);

async function login(email, password) {
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15000),
  });
  return { status: res.status, body: await res.text() };
}

const admin = await login(superEmail, superPw);
console.log(`admin login      -> ${admin.status}`);
if (admin.status !== 201) {
  console.log(admin.body.slice(0, 200));
  process.exit(1);
}
const token = JSON.parse(admin.body).data.accessToken;

const listRes = await fetch(`${base}/api/v1/users`, {
  headers: { Authorization: `Bearer ${token}` },
  signal: AbortSignal.timeout(15000),
});
const list = JSON.parse(await listRes.text()).data ?? [];
const student = list.find((u) => u.email === studentEmail);
if (!student) {
  console.log(`student ${studentEmail} not found`);
  process.exit(1);
}
console.log(`target           -> ${student.email} (${student.id})`);

const patch = await fetch(`${base}/api/v1/users/${student.id}/password`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ newPassword: newPw }),
  signal: AbortSignal.timeout(20000),
});
const patchBody = await patch.text();
console.log(`reset password   -> ${patch.status}`);
if (patch.status !== 200) console.log(patchBody.slice(0, 250));

const after = await login(studentEmail, newPw);
console.log(`student login    -> ${after.status} ${after.status === 201 ? 'OK' : after.body.slice(0, 160)}`);

console.log(after.status === 201 && patch.status === 200 ? '\nRESULT: OK' : '\nRESULT: FAILED');
process.exit(after.status === 201 && patch.status === 200 ? 0 : 1);
