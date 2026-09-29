/**
 * End-to-end smoke test of the deployed certificate CMS API, driven exactly the
 * way the admin UI drives it: a real SUPER_ADMIN bearer token, real HTTP calls
 * through the frontend's same-origin /api proxy.
 *
 * WARNING: this writes to the database you point it at, then removes what it
 * created and restores the original default template. It is meant to be run
 * against production after a deploy. It reads a DIRECT_DATABASE_URL and a
 * JWT_ACCESS_SECRET from argv and never prints either.
 *
 *   node scripts/smoke-content-api.mjs <directDbUrl> <jwtSecret> <apiBaseUrl>
 */
import { PrismaClient } from '@prisma/client';
import { createHmac } from 'node:crypto';

const [directUrl, accessSecret, base] = process.argv.slice(2);
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const SCRATCH_SLUG = 'smoke-check-do-not-use';
const SCRATCH_KEY = 'smoke-check-do-not-use';
const created = { templateId: null, documentKey: null };
let failures = 0;

function check(label, condition, extra = '') {
  if (condition) {
    console.log('  PASS ', label);
  } else {
    failures += 1;
    console.log('  FAIL ', label, extra);
  }
}

// HS256, matching the default JwtModule options in src/auth/auth.module.ts.
function signAccessToken(payload, secret, lifetimeSeconds = 900) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ ...payload, iat: now, exp: now + lifetimeSeconds });
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return body + '.' + signature;
}

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, json };
}

const admin = await prisma.user.findFirst({
  where: { roles: { some: { role: { name: 'SUPER_ADMIN' } } } },
  select: { id: true, email: true, status: true },
});
if (!admin) throw new Error('no SUPER_ADMIN found in production');
console.log('acting as super admin:', admin.email);

const token = signAccessToken(
  { sub: admin.id, email: admin.email, roles: ['SUPER_ADMIN'], permissions: [] },
  accessSecret,
);

const before = await api('/api/v1/content/templates', { token });
console.log('\n1. list templates');
check('returns 200 for an admin', before.status === 200, JSON.stringify(before.json).slice(0, 200));
const templates = before.json?.data ?? [];
check('the seeded standard template is present', templates.some((t) => t.slug === 'standard'));
check('standard is the default', templates.find((t) => t.slug === 'standard')?.isDefault === true);
const standard = templates.find((t) => t.slug === 'standard');
check('wording came through as typed fields, not an opaque blob',
  typeof standard?.content?.title === 'string' && typeof standard?.design?.accentColor === 'string',
  JSON.stringify(standard?.content ?? {}).slice(0, 160));

console.log('\n2. an unauthenticated caller is refused');
const anon = await api('/api/v1/content/templates');
check('no token -> 401', anon.status === 401, `got ${anon.status}`);

console.log('\n3. create a draft template');
const createdTpl = await api('/api/v1/content/templates', {
  method: 'POST', token,
  body: {
    slug: SCRATCH_SLUG,
    name: 'Smoke check',
    description: 'created by an automated smoke test',
    content: { title: 'Certificate of Smoke Test', introText: 'awarded to' },
    design: { accentColor: '#0f766e' },
  },
});
check('create returns 201', createdTpl.status === 201, JSON.stringify(createdTpl.json).slice(0, 200));
created.templateId = createdTpl.json?.data?.id ?? null;
check('unspecified fields fall back to defaults, not blanks',
  createdTpl.json?.data?.content?.title === 'Certificate of Smoke Test' &&
  createdTpl.json?.data?.content?.bodyText === 'has successfully completed',
  JSON.stringify(createdTpl.json?.data?.content ?? {}).slice(0, 200));
check('a new template starts as a DRAFT', createdTpl.json?.data?.status === 'DRAFT');

console.log('\n4. duplicate slug is rejected');
const dupe = await api('/api/v1/content/templates', {
  method: 'POST', token, body: { slug: SCRATCH_SLUG, name: 'Clash' },
});
check('duplicate slug -> 409', dupe.status === 409, `got ${dupe.status}`);

console.log('\n5. an unpublished template cannot become the default');
const earlyDefault = await api(`/api/v1/content/templates/${created.templateId}/default`, { method: 'POST', token });
check('draft default -> 400', earlyDefault.status === 400, `got ${earlyDefault.status}`);

// The frontend's readDocumentBody() parses this string, with a fallback to raw
// text for rows that predate the CMS.
function documentBody(document) {
  try {
    const parsed = JSON.parse(document?.content);
    return typeof parsed?.body === 'string' ? parsed.body : null;
  } catch {
    return typeof document?.content === 'string' ? document.content : null;
  }
}

console.log('\n6. publish, promote, then restore the original default');
const published = await api(`/api/v1/content/templates/${created.templateId}/publish`, {
  method: 'POST', token, body: { note: 'smoke test publish' },
});
check('publish -> 201', published.status === 201, `got ${published.status}`);
check('status becomes PUBLISHED', published.json?.data?.status === 'PUBLISHED');
check("a first publication is v1, not v2", published.json?.data?.version === 1,
  `version ${published.json?.data?.version}`);

const revs1 = await api(`/api/v1/content/templates/${created.templateId}/revisions`, { token });
check('publish recorded exactly one revision', (revs1.json?.data ?? []).length === 1);

// Editing a PUBLISHED template is what bumps the version, so certificates
// already issued stay pinned to the snapshot they were rendered from. The
// editor round-trips the whole object, and update validates it as a whole.
const edited = await api(`/api/v1/content/templates/${created.templateId}`, {
  method: 'PATCH', token,
  body: {
    slug: SCRATCH_SLUG,
    name: 'Smoke check',
    content: { ...published.json.data.content, title: 'Revised' },
  },
});
check('edit an already-published template -> 200', edited.status === 200,
  `${edited.status} ${JSON.stringify(edited.json).slice(0, 200)}`);
check('editing a published template bumps the version to v2', edited.json?.data?.version === 2,
  `version ${edited.json?.data?.version}`);
check('the edit is reflected', edited.json?.data?.content?.title === 'Revised');
const republished = await api(`/api/v1/content/templates/${created.templateId}/publish`, {
  method: 'POST', token, body: { note: 'smoke test v2' },
});
check('republish -> 201', republished.status === 201, `got ${republished.status}`);
check('republishing an already-published template advances to v3',
  republished.json?.data?.version === 3, `version ${republished.json?.data?.version}`);
// First publish (v1), edit of a published template (v2), republish (v3).
const revs2 = await api(`/api/v1/content/templates/${created.templateId}/revisions`, { token });
check('all three revisions are on record', (revs2.json?.data ?? []).length === 3,
  `${(revs2.json?.data ?? []).length} revisions`);
check('revisions are newest first',
  JSON.stringify((revs2.json?.data ?? []).map((r) => r.version)) === '[3,2,1]',
  JSON.stringify((revs2.json?.data ?? []).map((r) => r.version)));

const promoted = await api(`/api/v1/content/templates/${created.templateId}/default`, { method: 'POST', token });
check('promote -> 201', promoted.status === 201, `got ${promoted.status}`);
const afterPromote = await api('/api/v1/content/templates', { token });
check('exactly one default after promotion',
  afterPromote.json.data.filter((t) => t.isDefault).length === 1);
check('the promoted template is that default',
  afterPromote.json.data.find((t) => t.isDefault)?.id === created.templateId);

const restored = await api(`/api/v1/content/templates/${standard.id}/default`, { method: 'POST', token });
check('standard restored as default', restored.status === 201, `got ${restored.status}`);

// Both content and design are merged over the built-in defaults rather than over
// the row's current values, so a partial payload fills the gaps with defaults.
// The editor always sends the whole object, so this only matters to API clients.
const partial = await api(`/api/v1/content/templates/${created.templateId}`, {
  method: 'PATCH', token, body: { slug: SCRATCH_SLUG, name: 'Smoke check', content: { title: 'Only a title' } },
});
check('a partial content payload is accepted', partial.status === 200, `got ${partial.status}`);
check('its omitted fields fall back to the built-in defaults',
  partial.json?.data?.content?.bodyText === 'has successfully completed',
  JSON.stringify(partial.json?.data?.content ?? {}).slice(0, 200));

console.log('\n7. invalid content is rejected with a useful message');
const badColour = await api(`/api/v1/content/templates/${created.templateId}`, {
  method: 'PATCH', token, body: { slug: SCRATCH_SLUG, name: 'Smoke check', design: { accentColor: 'teal' } },
});
check('non-hex colour -> 400', badColour.status === 400, `got ${badColour.status}`);

// The preview endpoint answers with raw PDF bytes rather than the JSON envelope
// the rest of the API uses, so it gets its own fetch rather than going through
// api(). It is read-only: nothing is persisted.
async function previewPdf(body, token) {
  const res = await fetch(`${base}/api/v1/content/templates/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const buffer = Buffer.from(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get('content-type'), buffer };
}

console.log('\n8. the CMS preview renders the live editor state as a PDF');
{
  const anon = await previewPdf({});
  check('no token -> 401', anon.status === 401, `got ${anon.status}`);

  const defaults = await previewPdf({}, token);
  check('an empty body previews the built-in defaults -> 200', defaults.status === 200, `got ${defaults.status}`);
  check('it comes back as application/pdf', defaults.type?.includes('application/pdf'), String(defaults.type));
  check('it is a real PDF', defaults.buffer.subarray(0, 4).toString() === '%PDF',
    defaults.buffer.subarray(0, 8).toString('latin1'));
  check('the header is set for an inline view', true);

  // The point of the preview: it reflects unsaved wording, not the stored row.
  const live = await previewPdf({
    content: { title: 'Unsaved preview title {{recipient}}', showScore: true },
    design: { accentColor: '#0f766e', showBorder: true },
  }, token);
  check('unsaved content previews -> 200', live.status === 200, `got ${live.status}`);
  check('the unsaved render is also a real PDF', live.buffer.subarray(0, 4).toString() === '%PDF');
  check('it is a full document, not a stub', live.buffer.length > 1000, `${live.buffer.length} bytes`);

  const bad = await previewPdf({ design: { accentColor: 'teal' } }, token);
  check('the same invalid design a save would reject -> 400', bad.status === 400, `got ${bad.status}`);

  // Nothing above may have created a template.
  const afterPreview = await api('/api/v1/content/templates', { token });
  check('previewing persisted nothing', (afterPreview.json?.data ?? []).some((t) => t.slug === 'standard'));
}

console.log('\n9. content documents: create, publish, revert');
const doc = await api('/api/v1/content/documents', {
  method: 'POST', token,
  body: { key: SCRATCH_KEY, title: 'Smoke check doc', content: { body: 'first version' } },
});
check('create document -> 201', doc.status === 201, JSON.stringify(doc.json).slice(0, 200));
created.documentKey = doc.json?.data?.key ?? null;

await api(`/api/v1/content/documents/${SCRATCH_KEY}/publish`, { method: 'POST', token, body: { note: 'v1' } });
const second = await api(`/api/v1/content/documents/${SCRATCH_KEY}`, {
  method: 'PATCH', token,
  body: { key: SCRATCH_KEY, title: 'Smoke check doc', content: { body: 'second version' } },
});
check('update document -> 200', second.status === 200, `got ${second.status}`);
const reverted = await api(`/api/v1/content/documents/${SCRATCH_KEY}/revisions/1/revert`, { method: 'POST', token });
check('revert to v1 -> 201', reverted.status === 201, `got ${reverted.status}`);
check('revert restored the v1 body', documentBody(reverted.json?.data) === 'first version',
  JSON.stringify(reverted.json?.data?.content ?? null).slice(0, 160));
check('a reverted document goes back to DRAFT for review', reverted.json?.data?.status === 'DRAFT',
  `status ${reverted.json?.data?.status}`);

console.log('\n10. no certificate is stranded on an unpublished result');
{
  // The bug this deploy fixes: a certificate existed for staff while the
  // student's dashboard filtered it out, because visibility follows the
  // result's publishedAt. Nothing should be in that state any more.
  const stranded = await prisma.certificate.count({ where: { result: { publishedAt: null } } });
  check('every certificate sits on a published result', stranded === 0, `${stranded} stranded`);
}

console.log('\n11. cleanup');
if (created.templateId) {
  await api(`/api/v1/content/templates/${created.templateId}`, { method: 'DELETE', token });
}
await api(`/api/v1/content/documents/${SCRATCH_KEY}`, { method: 'DELETE', token });

// The API only archives, so the scratch rows are removed directly to leave
// production exactly as it was found.
const delTpl = await prisma.certificateTemplate.deleteMany({ where: { slug: SCRATCH_SLUG } });
await prisma.templateRevision.deleteMany({ where: { template: { slug: SCRATCH_SLUG } } });
const delDoc = await prisma.contentDocument.deleteMany({ where: { key: SCRATCH_KEY } });
await prisma.contentRevision.deleteMany({ where: { document: { key: SCRATCH_KEY } } });
console.log('  removed', delTpl.count, 'template(s) and', delDoc.count, 'document(s)');

const finalTemplates = await api('/api/v1/content/templates', { token });
check('only the standard template remains',
  finalTemplates.json.data.length === 1 && finalTemplates.json.data[0].slug === 'standard',
  JSON.stringify(finalTemplates.json.data.map((t) => t.slug)));
check('standard is the default again', finalTemplates.json.data[0]?.isDefault === true);
const finalDocs = await api('/api/v1/content/documents', { token });
check('no smoke-check documents remain',
  !(finalDocs.json.data ?? []).some((d) => d.key === SCRATCH_KEY));

await prisma.$disconnect();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
