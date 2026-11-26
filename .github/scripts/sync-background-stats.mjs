import fs from "node:fs";

const API = "https://abacus.jasoncameron.dev";
const NAMESPACE = "animatedbackgrounds.me";
const BACKGROUNDS_FILE = "data/backgrounds.json";
const STATS_FILE = "data/stats.json";
const MIN_GAP_MS = 430; // 23 requests per 10 seconds, below Abacus's 30/IP limit. Keep this conservative.
let lastRequestAt = 0;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function retryDelay(response, attempt) {
  const header = response.headers.get("Retry-After");
  let ms = header ? Number(header) : NaN;
  if (!Number.isFinite(ms) && header) {
    const date = Date.parse(header);
    if (Number.isFinite(date)) ms = date - Date.now();
  }
  if (!(ms > 0)) {
    const reset = Number(response.headers.get("RateLimit-Reset"));
    if (Number.isFinite(reset) && reset > 0) ms = reset * 1000 - Date.now();
  }
  if (!(ms > 0)) ms = 1200 * (attempt + 1);
  return Math.min(20000, Math.max(1000, ms)) + Math.floor(Math.random() * 150);
}

async function getCounter(key) {
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const gap = MIN_GAP_MS - (Date.now() - lastRequestAt);
    if (gap > 0) await sleep(gap);
    lastRequestAt = Date.now();

    let response;
    try {
      response = await fetch(`${API}/get/${NAMESPACE}/${encodeURIComponent(key)}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(20000)
      });
    } catch (error) {
      if (attempt >= 3) throw new Error(`Network failure reading ${key}: ${error.message}`);
      await sleep(800 * (attempt + 1));
      continue;
    }

    // Abacus returns 404 for counters that have never been created.
    if (response.status === 404) return 0;

    if (response.status === 429 && attempt < 6) {
      const delay = retryDelay(response, attempt);
      console.log(`Rate limited while reading ${key}; retrying in ${Math.round(delay)} ms.`);
      await sleep(delay);
      continue;
    }

    if (!response.ok) {
      if (response.status >= 500 && attempt < 3) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      const body = await response.text().catch(() => "");
      throw new Error(`Abacus returned HTTP ${response.status} for ${key}: ${body.slice(0, 400)}`);
    }

    const body = await response.json();
    if (!Number.isSafeInteger(body.value) || body.value < 0) {
      throw new Error(`Invalid counter value for ${key}: ${JSON.stringify(body)}`);
    }
    return body.value;
  }

  throw new Error(`Could not read counter after retries: ${key}`);
}

async function main() {
  const library = JSON.parse(fs.readFileSync(BACKGROUNDS_FILE, "utf8"));
  const previous = JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
  if (!Array.isArray(library.backgrounds)) throw new Error("data/backgrounds.json has no backgrounds array.");

  const activeIds = library.backgrounds.filter(item => !item.hidden).map(item => String(item.id));
  const ids = [...new Set([...activeIds, ...Object.keys(previous.b || {})])].sort();
  const next = {};
  const started = Date.now();

  console.log(`Refreshing global counters for ${ids.length} backgrounds (${ids.length * 2} reads).`);
  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    // Await each read separately. Promise.all would send two requests at
    // the same instant and defeat the per-IP rate-limit spacing above.
    const views = await getCounter(`v-${id}`);
    const likes = await getCounter(`l-${id}`);

    if (views > 0 || likes > 0) next[id] = [views, likes];

    if ((index + 1) % 25 === 0 || index + 1 === ids.length) {
      const elapsed = Math.round((Date.now() - started) / 1000);
      console.log(`Progress: ${index + 1}/${ids.length} backgrounds; ${Object.keys(next).length} with activity; ${elapsed}s elapsed.`);
    }
  }

  // Write only after every read succeeds so a partial run never replaces good stats.
  const output = JSON.stringify({ updated: Date.now(), b: next }) + "\n";
  fs.writeFileSync(STATS_FILE, output);
  console.log(`Stats snapshot written: ${Object.keys(next).length} active backgrounds with counts.`);
}

main().catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
