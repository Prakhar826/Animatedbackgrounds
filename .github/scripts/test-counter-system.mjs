import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const app = fs.readFileSync("assets/js/app.js", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");
const statsSync = fs.readFileSync(".github/scripts/sync-background-stats.mjs", "utf8");

function extract(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing source marker: ${startMarker}`);
  const end = app.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Missing end marker: ${endMarker}`);
  return app.slice(start, end);
}

function makeResponse(status, value, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: name => headers[name] ?? headers[name.toLowerCase()] ?? null },
    async json() { return typeof value === "object" ? value : { value }; }
  };
}

async function testCounterClient() {
  const delays = [];
  const responses = [];
  const calls = [];
  const counterSource = extract("  const Counter = (() => {", "\n  /* ---------------- state ---------------- */");
  const context = {
    fetch: async (url, options) => {
      calls.push({ url, options });
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next;
    },
    Promise, Date, Math,
    AbortSignal: { timeout: ms => ({ timeoutMs: ms }) },
    setTimeout: (fn, ms) => { delays.push(ms); fn(); return 1; }
  };
  vm.runInNewContext(`const COUNTER_API = "https://abacus.jasoncameron.dev"; const NS = "animatedbackgrounds.me";\n${counterSource}\nglobalThis.__Counter = Counter;`, context);
  const Counter = context.__Counter;

  responses.push(makeResponse(200, 7));
  assert.equal(await Counter.hit("v-test"), 7, "hit returns the server's confirmed count");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /hit\/animatedbackgrounds\.me\/v-test$/);
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.signal.timeoutMs, 20000, "counter requests have a finite timeout");

  responses.push(makeResponse(429, { error: "rate limited" }, { "Retry-After": "1800" }));
  responses.push(makeResponse(200, 8));
  assert.equal(await Counter.hit("l-test"), 8, "explicit 429 is retried and succeeds");
  assert.equal(calls.length, 3);
  assert.ok(delays.some(ms => ms >= 1800), "Retry-After is respected");

  responses.push(makeResponse(404, { error: "Key not found" }));
  assert.equal(await Counter.get("l-missing"), 0, "missing counters are read as zero");

  responses.push(makeResponse(503, { error: "temporary failure" }));
  const beforeHitFailure = calls.length;
  assert.equal(await Counter.hit("v-uncertain"), null, "a failed hit is not reported as successful");
  assert.equal(calls.length, beforeHitFailure + 1, "uncertain hit failures are not blindly retried");

  responses.push(makeResponse(503, { error: "temporary failure" }));
  responses.push(makeResponse(200, 9));
  assert.equal(await Counter.get("l-retry"), 9, "safe GET requests retry transient server failures");
  assert.equal(calls.length, beforeHitFailure + 3);
}

async function testViewRetryState() {
  const block = extract("  async function countView(id) {", "\n  async function fetchLikes(id)");
  const stored = new Map();
  const patches = [];
  let nextHit = null;
  const context = {
    Counter: {
      hit: async () => nextHit,
      get: async () => 4
    },
    ckey: (p, id) => p + "-" + id,
    session: {
      get: key => stored.get(key) ?? null,
      set: (key, value) => stored.set(key, value)
    },
    setLive: (id, value) => patches.push({ id, value }),
    refreshCounts: () => {}
  };
  vm.runInNewContext(block + "\nglobalThis.__countView = countView;", context);

  nextHit = null;
  await context.__countView("bg-1");
  assert.equal(stored.has("v:bg-1"), false, "failed view increment is not permanently marked as counted");

  nextHit = 3;
  await context.__countView("bg-1");
  assert.equal(stored.get("v:bg-1"), "1", "successful view increment is marked for this session");
  assert.equal(patches.at(-1).value.v, 3);

  await context.__countView("bg-1");
  assert.equal(patches.at(-1).value.v, 4, "subsequent opens read, rather than increment, the session count");
}

function makeLikesHarness(hitValues) {
  const data = { likes: [], likedEver: {} };
  const live = {};
  const store = {
    get(key, fallback) { return data[key] === undefined ? fallback : structuredClone(data[key]); },
    set(key, value) { data[key] = structuredClone(value); }
  };
  const block = extract("  const Likes = {", "\n  function updateNavCounts()");
  const context = {
    store,
    Counter: { hit: async () => {
      const next = hitValues.shift() ?? null;
      return typeof next === "function" ? next() : next;
    } },
    ckey: (prefix, id) => prefix + "-" + id,
    setLive: (id, patch) => { live[id] = { ...(live[id] || {}), ...patch }; },
    refreshCounts: () => {},
    updateNavCounts: () => {},
    Date, Set, structuredClone
  };
  vm.runInNewContext(block + "\nglobalThis.__Likes = Likes;", context);
  return { Likes: context.__Likes, data, live };
}

async function testLikeRequestCoalescing() {
  let resolveHit;
  const pending = new Promise(resolve => { resolveHit = resolve; });
  const harness = makeLikesHarness([() => pending]);
  harness.Likes.toggle("bg-fast");
  const first = harness.Likes.count("bg-fast");
  const second = harness.Likes.count("bg-fast");

  assert.equal(first, second, "rapid repeat like clicks share one in-flight request");
  resolveHit(21);
  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(harness.live["bg-fast"].l, 21);
  assert.ok(harness.Likes.ever["bg-fast"]);
}

async function testLikeConfirmation() {
  const ok = makeLikesHarness([12]);
  assert.equal(ok.Likes.toggle("bg-like"), true);
  assert.equal(ok.Likes.has("bg-like"), true, "favorite is saved locally immediately");
  assert.equal(ok.Likes.ever["bg-like"], undefined, "global like is not pre-marked before confirmation");
  assert.equal(await ok.Likes.count("bg-like"), true);
  assert.ok(ok.Likes.ever["bg-like"], "global like is marked only after a confirmed API response");
  assert.equal(ok.live["bg-like"].l, 12);

  ok.Likes.toggle("bg-like");
  assert.equal(ok.live["bg-like"].l, 12, "unliking a local favorite does not invent a browser-only global decrement");
  ok.Likes.toggle("bg-like");
  assert.equal(await ok.Likes.count("bg-like"), true, "re-favoriting a browser already counted does not add a duplicate");
  assert.equal(ok.live["bg-like"].l, 12);

  const failed = makeLikesHarness([null, 14]);
  failed.Likes.toggle("bg-fail");
  assert.equal(await failed.Likes.count("bg-fail"), false, "failed API call is surfaced");
  assert.equal(failed.Likes.ever["bg-fail"], undefined, "failed API call remains eligible for a later retry");
  failed.Likes.toggle("bg-fail");
  assert.equal(await failed.Likes.count("bg-fail"), true, "retry can recover after a failed request");
  assert.ok(failed.Likes.ever["bg-fail"]);
  assert.equal(failed.live["bg-fail"].l, 14);
}

function testCumulativeLikesNeverRegress() {
  const start = app.indexOf("  function likesOf(id) {");
  const end = app.indexOf("\n  const score =", start);
  assert.ok(start >= 0 && end > start, "likesOf function is available for the regression test");
  const context = {
    S: { stats: { b: { "bg-1": [20, 9] }, updated: 999999 }, live: { "bg-1": { l: 12, t: 1 } } },
    Likes: { has: () => false },
    Math
  };
  vm.runInNewContext(app.slice(start, end) + "\nglobalThis.__likesOf = likesOf;", context);
  assert.equal(context.__likesOf("bg-1"), 12, "newer live cumulative likes survive a newer snapshot timestamp");
  context.S.live["bg-1"].l = 4;
  assert.equal(context.__likesOf("bg-1"), 9, "a live value never lowers the shared cumulative count");
}

async function testStatsReaderRateLimit() {
  const retryStart = statsSync.indexOf("function retryDelay(response, attempt) {");
  const getStart = statsSync.indexOf("async function getCounter(key) {");
  const mainStart = statsSync.indexOf("\n\nasync function main()", getStart);
  assert.ok(retryStart >= 0 && getStart > retryStart && mainStart > getStart, "stats synchronizer exposes the expected rate-limited reader");

  const retryBlock = statsSync.slice(retryStart, getStart);
  const getBlock = statsSync.slice(getStart, mainStart);
  let clock = 10000;
  const starts = [];
  const delays = [];
  const responses = [
    makeResponse(200, 4),
    makeResponse(200, 6),
    makeResponse(429, { error: "rate limited" }, { "Retry-After": "1500" }),
    makeResponse(200, 7)
  ];
  const context = {
    API: "https://abacus.jasoncameron.dev",
    NAMESPACE: "animatedbackgrounds.me",
    MIN_GAP_MS: 430,
    lastRequestAt: 0,
    Date: { now: () => clock },
    Math,
    AbortSignal: { timeout: () => ({}) },
    sleep: async ms => { delays.push(ms); clock += ms; },
    fetch: async () => {
      starts.push(clock);
      const response = responses.shift();
      if (!response) throw new Error("Unexpected additional counter request");
      return response;
    }
  };
  vm.runInNewContext(`${retryBlock}\n${getBlock}\nglobalThis.__getCounter = getCounter;`, context);

  assert.equal(await context.__getCounter("v-bg-1"), 4);
  assert.equal(await context.__getCounter("l-bg-1"), 6);
  assert.ok(starts[1] - starts[0] >= 430, "stats requests are spaced by at least 430 ms");

  assert.equal(await context.__getCounter("v-bg-2"), 7, "explicit 429 is retried");
  assert.ok(delays.some(ms => ms >= 1500), "stats reader respects Retry-After");

  assert.doesNotMatch(statsSync, /Promise\.all\(\s*\[\s*getCounter/, "views and likes are not fetched concurrently");
  assert.match(statsSync, /const views = await getCounter\([\s\S]*const likes = await getCounter\(/, "each pair of counters is awaited sequentially");
}

function testBrowserConsistencyGuards() {
  assert.match(app, /live:\s*\{\}/, "live counter cache is memory-only");
  assert.doesNotMatch(app, /store\.set\('live',\s*S\.live\)/, "global counter values are not persisted per browser");
  assert.match(app, /fetch\('\/data\/stats\.json',\s*\{\s*cache:\s*'no-store'\s*\}\)/, "shared global stats bypass stale browser HTTP cache");
  assert.match(app, /if \(!already && v != null\) session\.set\('v:' \+ id, '1'\)/, "view session marker requires server confirmation");
  assert.match(app, /if \(value == null\) return false;[\s\S]*this\.ever\[id\] = Date\.now\(\)/, "like lifetime marker requires server confirmation");
  assert.match(sw, /url\.pathname === '\/assets\/js\/app\.js'[\s\S]*networkFirst\(req, CORE\)/, "service worker refreshes the app script network-first");
}

await testCounterClient();
await testViewRetryState();
await testLikeConfirmation();
await testLikeRequestCoalescing();
await testStatsReaderRateLimit();
testCumulativeLikesNeverRegress();
testBrowserConsistencyGuards();
console.log("PASS: browser counter retries, failed-view recovery, confirmed-like state, request timeouts and coalescing, cross-browser cache guards, service-worker freshness, serialized stats reads, and cumulative-like monotonicity.");
