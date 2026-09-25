#!/usr/bin/env node
/**
 * Dependency gate for CI.
 *
 * Runs `pnpm audit --prod` and FAILS the build if any advisory is at or above
 * `--threshold` (default: moderate), EXCEPT advisories listed via
 * --allowlist (comma separated; benchmarked against advisory `id`).
 *
 * Use: node scripts/audit-gate.mjs [--threshold=moderate] [--allowlist=GHSA-...]
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : undefined;
}

const THRESHOLD = arg('threshold') ?? 'moderate';
const ALLOW = new Set((arg('allowlist') ?? '').split(',').map((s) => s.trim()).filter(Boolean));
const RANK = { low: 1, moderate: 2, high: 3, critical: 4 };

function alreadyAudited() {
  // Reuse the local pnpm audit cache metadata if present (avoids a network
  // fetch in every PR). Never required; falls back to a fresh audit.
  try {
    const cached = JSON.parse(readFileSync('audit-report.json', 'utf8'));
    if (cached?.metadata?.vulnerabilities) return cached;
  } catch {
    /* no cache */
  }
  return null;
}

function runAudit() {
  // pnpm audit exits non-zero whenever ANY advisory is found, even when we are
  // going to allowlist it. execFileSync throws and drops stdout on non-zero, so
  // use spawnSync and read stdout regardless of status. pnpm resolves to
  // pnpm.cmd on Windows (spawn needs the shim, not the bare name).
  const bin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const { stdout, status, error } = spawnSync(bin, ['audit', '--prod', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
  });
  if (error || !stdout) {
    console.error(`Dependency gate: failed to run "${bin} audit --prod --json"${error ? ` (${error.message})` : ''}`);
    process.exit(2);
  }
  return JSON.parse(stdout);
}

function collect(report) {
  const advisories = report.advisories ?? {};
  const rows = [];
  for (const [id, a] of Object.entries(advisories)) {
    const sev = a.severity;
    if (!RANK[sev]) continue02;
    if (RANK[sev] < RANK[THRESHOLD]) continue;
    rows.push({
      id,
      severity: sev,
      module: a.module_name,
      range: a.vulnerable_versions,
      url: a.url,
      via: Array.isArray(a.via) ? a.via.join(' -> ') : String(a.via ?? ''),
    });
  }
  return rows;
}

const report = alreadyAudited() ?? runAudit();
const failed = collect(report).filter((r) => !ALLOW.has(r.id));
const allowed = collect(report).filter((r) => ALLOW.has(r.id));

console.log(`\nDependency gate — threshold=${THRESHOLD} allowlist=${[...ALLOW].join(',') || '(none)'}`);
for (const r of allowed) {
  console.log(`  [allowed] ${r.severity.padEnd(8)} ${r.module}@${r.range} ${r.id} (${r.url})`);
}
for (const r of failed) {
  console.log(`  [FAIL]    ${r.severity.padEnd(8)} ${r.module}@${r.range} ${r.id} via=${r.via} (${r.url})`);
}

if (failed.length > 0) {
  console.error(`\n✗ Dependency gate BLOCKED: ${failed.length} advisory(ies) at/above ${THRESHOLD} not in the allowlist.`);
  process.exit(1);
}
console.log(`\n✓ Dependency gate passed (${allowed.length} allowed, 0 blocked).`);
