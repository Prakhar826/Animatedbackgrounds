const API_BASE = "https://www.outrank.so/api/agent/v1";
const API_KEY = process.env.OUTRANK_API_KEY;
const EXPECTED_DOMAIN = (process.env.OUTRANK_EXPECTED_BLOG_DOMAIN || "blog.animatedbackgrounds.me").toLowerCase();

function stop(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

async function request(path) {
  const response = await fetch(API_BASE + path, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(30000)
  });
  const raw = await response.text();
  let body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = { message: raw.slice(0, 1000) };
  }
  return { status: response.status, ok: response.ok, body };
}

function unwrap(value) {
  return value?.data ?? value;
}

function getProducts(payload) {
  const data = unwrap(payload);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function stringsForDomain(value, path = "$", out = []) {
  if (typeof value === "string") {
    if (value.toLowerCase().includes(EXPECTED_DOMAIN) || /domain|url|host|slug/i.test(path)) {
      out.push({ field: path, value: value.slice(0, 300) });
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => stringsForDomain(item, `${path}[${index}]`, out));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      stringsForDomain(child, `${path}.${key}`, out);
    }
  }
  return out.slice(0, 20);
}

async function main() {
  if (!API_KEY) stop("Missing OUTRANK_API_KEY. Add it as a GitHub Actions repository secret.");

  console.log("Checking Outrank API authentication...");
  const who = await request("/auth/whoami");
  if (!who.ok) {
    stop(`Authentication check failed with HTTP ${who.status}. Check that the repository secret OUTRANK_API_KEY contains the complete, active key. Response: ${JSON.stringify(who.body).slice(0, 1200)}`);
  }

  const account = unwrap(who.body) || {};
  const user = account.user || {};
  const org = account.organization || {};
  const entitlements = account.entitlements || {};
  const toolsets = entitlements.toolsets || {};
  const unverified = entitlements.unverified_toolsets || {};
  console.log("Authentication: successful");
  console.log(`Account role: ${user.role || "not returned"}`);
  console.log(`Organization subscribed: ${String(org.subscribed ?? "not returned")}`);
  console.log(`Seller flow started: ${String(entitlements.flows?.marketplace_seller ?? "not returned")}`);
  console.log(`Blog entitlement: ${toolsets.blog || (unverified.blog ? "unverified" : "not listed")}`);
  console.log(`Marketplace seller entitlement: ${toolsets["marketplace-seller"] || (unverified["marketplace-seller"] ? "unverified" : "not listed")}`);

  console.log("Checking products...");
  const listed = await request("/products");
  if (!listed.ok) {
    console.log(`Products endpoint: HTTP ${listed.status} — ${JSON.stringify(listed.body).slice(0, 1200)}`);
    return;
  }

  const products = getProducts(listed.body);
  console.log(`Products returned: ${products.length}`);
  if (!products.length) {
    console.log("Product response keys: " + Object.keys(unwrap(listed.body) || {}).join(", "));
    console.log("No product records were found in the expected data/products/items arrays.");
    return;
  }

  let matched = 0;
  for (const product of products) {
    const id = product?.id || product?.product_id;
    const name = product?.name || product?.title || product?.domain || "Unnamed product";
    if (!id) {
      console.log(`Product without an id: ${name}`);
      continue;
    }

    console.log(`Product: ${name} (id: ${id})`);
    const blog = await request(`/products/${encodeURIComponent(id)}/blog`);
    if (!blog.ok) {
      console.log(`  Blog endpoint: HTTP ${blog.status} — ${JSON.stringify(blog.body).slice(0, 500)}`);
      continue;
    }

    const hints = stringsForDomain(blog.body);
    const matches = JSON.stringify(blog.body).toLowerCase().includes(EXPECTED_DOMAIN);
    if (matches) matched += 1;
    console.log(`  Blog endpoint: HTTP 200; expected domain match: ${matches ? "YES" : "NO"}`);
    if (hints.length) console.log("  Blog address fields: " + JSON.stringify(hints));
  }

  console.log(`Products whose blog response contains ${EXPECTED_DOMAIN}: ${matched}`);
  console.log("This check is read-only. It did not create or publish any post.");
}

main().catch((error) => stop(error?.stack || error?.message || String(error)));
