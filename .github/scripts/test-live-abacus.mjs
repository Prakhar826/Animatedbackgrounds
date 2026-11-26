import assert from "node:assert/strict";

const API = "https://abacus.jasoncameron.dev";
const namespace = "animatedbackgrounds-test";
const run = process.env.GITHUB_RUN_ID || String(Date.now());
const attempt = process.env.GITHUB_RUN_ATTEMPT || "1";
const key = `smoke-${run}-${attempt}`;

async function request(path) {
  const response = await fetch(`${API}/${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });
  const raw = await response.text();
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }
  return { status: response.status, ok: response.ok, body };
}

async function main() {
  const before = await request(`get/${namespace}/${key}`);
  const baseline = before.status === 404 ? 0 : before.body.value;
  if (before.status !== 404 && (!before.ok || !Number.isSafeInteger(baseline))) {
    throw new Error(`Initial Abacus read failed: HTTP ${before.status} ${JSON.stringify(before.body)}`);
  }

  const hit = await request(`hit/${namespace}/${key}`);
  assert.equal(hit.status, 200, `Abacus hit should return HTTP 200: ${JSON.stringify(hit.body)}`);
  assert.equal(hit.body.value, baseline + 1, "hit must increment exactly once and return the new count");

  const after = await request(`get/${namespace}/${key}`);
  assert.equal(after.status, 200, "Abacus get should read the created test counter");
  assert.equal(after.body.value, hit.body.value, "get must return the value written by hit");

  console.log(`PASS: live Abacus hit/get verified in isolated namespace. Test key: ${namespace}/${key}. Production background counters were not touched.`);

  // Read-only checks against real production counters; never increment them.
  for (const productionKey of ["v-ByVyzb", "l-ByVyzb", "v-AmqdWE", "l-AmqdWE"]) {
    const production = await request(`get/animatedbackgrounds.me/${productionKey}`);
    if (production.status === 404) {
      console.log(`Production counter not created yet: ${productionKey} (0)`);
      continue;
    }
    assert.equal(production.status, 200, `Production counter read failed for ${productionKey}: ${JSON.stringify(production.body)}`);
    assert.ok(Number.isSafeInteger(production.body.value) && production.body.value >= 0, `Invalid production value for ${productionKey}`);
    console.log(`Production counter read OK: ${productionKey} = ${production.body.value}`);
  }
}

main().catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
