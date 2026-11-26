import fs from "node:fs";

const API_BASE = "https://techtools.cz/launchpad-api";
const MANIFEST = process.argv[2] || "backlink-queue/techtools-launchpad.json";

function stop(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function findItems(value, items = []) {
  if (Array.isArray(value)) {
    for (const item of value) findItems(item, items);
  } else if (value && typeof value === "object") {
    if (typeof value.url === "string" && typeof value.name === "string") items.push(value);
    for (const child of Object.values(value)) findItems(child, items);
  }
  return items;
}

async function api(path, options) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...options?.headers
    },
    signal: AbortSignal.timeout(30000)
  });
  const raw = await response.text();
  let body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = { raw: raw.slice(0, 1500) };
  }
  return { response, body };
}

async function main() {
  if (!fs.existsSync(MANIFEST)) stop(`Submission manifest not found: ${MANIFEST}`);

  let listing;
  try {
    listing = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch (error) {
    stop(`Could not parse ${MANIFEST}: ${error.message}`);
  }

  if (!listing.name || !listing.url) stop("The listing must include name and url.");
  const target = new URL(listing.url);
  if (target.protocol !== "https:" || target.hostname !== "animatedbackgrounds.me") {
    stop("For safety, this workflow only submits the verified Animated Backgrounds HTTPS domain.");
  }
  if (String(listing.tagline || "").length > 150) stop("Tagline exceeds the directory's 150-character limit.");
  if (String(listing.description || "").length > 2000) stop("Description exceeds the directory's 2000-character limit.");

  console.log(`Checking whether ${listing.url} is already listed...`);
  let duplicate = false;
  for (let page = 1; page <= 10; page += 1) {
    const { response, body } = await api(`/tools?page=${page}&per_page=100&sort=recent`);
    if (!response.ok) stop(`Could not check existing listings (HTTP ${response.status}): ${JSON.stringify(body).slice(0, 1000)}`);
    const items = findItems(body);
    if (items.some((item) => {
      try { return new URL(item.url).hostname.replace(/^www\./, "") === target.hostname; }
      catch { return item.url === listing.url; }
    })) {
      duplicate = true;
      break;
    }
    if (items.length < 100) break;
  }

  if (duplicate) {
    console.log("This domain is already listed. No duplicate submission was made.");
    return;
  }

  console.log("No existing listing found. Submitting one directory entry...");
  const { response, body } = await api("/tools", {
    method: "POST",
    body: JSON.stringify(listing)
  });

  if (!response.ok) {
    if (response.status === 409) {
      console.log("The directory rejected this as a duplicate. No further action is needed.");
      return;
    }
    stop(`Submission failed (HTTP ${response.status}): ${JSON.stringify(body).slice(0, 1500)}`);
  }

  console.log("Directory submission accepted.");
  console.log(JSON.stringify(body, null, 2));
}

main().catch((error) => stop(error?.stack || error?.message || String(error)));
