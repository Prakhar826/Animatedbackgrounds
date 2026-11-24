import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const API_BASE = "https://www.outrank.so/api/agent/v1";
const API_KEY = process.env.OUTRANK_API_KEY;
const PRODUCT_ID = process.env.OUTRANK_PRODUCT_ID;
const EXPECTED_BLOG_DOMAIN = (process.env.OUTRANK_EXPECTED_BLOG_DOMAIN || "blog.animatedbackgrounds.me").toLowerCase();

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function parseScalar(value) {
  const text = value.trim();
  if (!text) return "";
  if (text === "null" || text === "~") return "";
  if (text === "true") return true;
  if (text === "false") return false;
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    const quote = text[0];
    const inner = text.slice(1, -1);
    return quote === '"' ? inner.replace(/\\n/g, "\n").replace(/\\"/g, '"') : inner.replace(/''/g, "'");
  }
  if (text.startsWith("[") && text.endsWith("]")) {
    const inner = text.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(/,(?=(?:[^'"]|'[^']*'|"[^"]*")*$)/).map((item) => String(parseScalar(item))).filter(Boolean);
  }
  return text.replace(/\s+#.*$/, "").trim();
}

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { metadata: {}, body: source.trim() };

  const lines = match[1].split(/\r?\n/);
  const metadata = {};
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!field) continue;

    const key = field[1];
    const rawValue = field[2].trim();
    if (rawValue === "|" || rawValue === "|-" || rawValue === ">" || rawValue === ">-") {
      const block = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) {
        block.push(lines[++i].trim());
      }
      metadata[key] = block.join(rawValue.startsWith(">") ? " " : "\n");
    } else if (rawValue === "") {
      const items = [];
      while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) {
        items.push(parseScalar(lines[++i].replace(/^\s+-\s+/, "")));
      }
      metadata[key] = items;
    } else {
      metadata[key] = parseScalar(rawValue);
    }
  }

  return { metadata, body: source.slice(match[0].length).trim() };
}

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toTags(value) {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((tag) => tag.trim()).filter(Boolean);
  return [];
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    },
    signal: AbortSignal.timeout(30000)
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text.slice(0, 2000) };
  }
  return { response, payload };
}

function changedArticleFiles(baseSha, mergeSha) {
  const changed = execFileSync("git", ["diff", "--diff-filter=AM", "--name-only", baseSha, mergeSha], {
    encoding: "utf8"
  }).split(/\r?\n/).filter(Boolean);

  return changed.filter((file) => file.startsWith("content/blog/") && file.endsWith(".mdx"));
}

function extractArticle(filePath) {
  const source = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const { metadata, body: originalBody } = parseFrontmatter(source);
  let body = originalBody.replace(/^import\s+.+?;?\s*$/gm, "").trim();

  const h1 = body.match(/^#\s+(.+)$/m);
  const title = asText(metadata.title) || (h1 ? h1[1].trim() : "") ||
    path.basename(filePath, path.extname(filePath)).replace(/[-_]+/g, " ");

  if (h1 && h1[1].trim().toLowerCase() === title.toLowerCase()) {
    body = body.replace(/^#\s+.+(?:\r?\n)+/m, "").trim();
  }

  const description = asText(metadata.metaDescription) ||
    asText(metadata.meta_description) ||
    asText(metadata.description) ||
    asText(metadata.excerpt) ||
    asText(metadata.summary);

  if (!title || !body || body.length < 120) {
    throw new Error(`Article file "${filePath}" needs a title and at least 120 characters of body text.`);
  }

  const post = { title, content: body, status: "published" };
  if (description) post.metaDescription = description.slice(0, 320);
  const tags = toTags(metadata.tags);
  if (tags.length) post.tags = tags;
  const category = asText(metadata.category);
  if (category) post.newCategoryName = category;

  return post;
}

function collectIds(value, ids = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectIds(item, ids);
  } else if (value && typeof value === "object") {
    if (typeof value.id === "string" && /^[0-9a-f-]{16,}$/i.test(value.id)) ids.add(value.id);
    for (const child of Object.values(value)) collectIds(child, ids);
  }
  return ids;
}

async function verifyProductBlog(productId) {
  const url = `${API_BASE}/products/${encodeURIComponent(productId)}/blog`;
  const { response, payload } = await apiRequest(url);
  if (!response.ok) return false;
  return JSON.stringify(payload).toLowerCase().includes(EXPECTED_BLOG_DOMAIN);
}

async function resolveProductId() {
  if (PRODUCT_ID) {
    if (!(await verifyProductBlog(PRODUCT_ID))) {
      fail(`OUTRANK_PRODUCT_ID does not resolve to the expected blog "${EXPECTED_BLOG_DOMAIN}". Nothing was published.`);
    }
    return PRODUCT_ID;
  }

  const { response, payload } = await apiRequest(`${API_BASE}/products`);
  if (!response.ok) {
    fail(`Could not list Outrank products (HTTP ${response.status}): ${JSON.stringify(payload).slice(0, 1200)}`);
  }

  const matches = [];
  for (const candidateId of collectIds(payload)) {
    if (await verifyProductBlog(candidateId)) matches.push(candidateId);
  }

  if (matches.length !== 1) {
    fail(matches.length
      ? `More than one Outrank product matches "${EXPECTED_BLOG_DOMAIN}". Add the correct OUTRANK_PRODUCT_ID as a repository variable.`
      : `Could not find an Outrank product whose hosted blog is "${EXPECTED_BLOG_DOMAIN}". Check the API key and that this exact blog is enabled for the product. You can set OUTRANK_PRODUCT_ID as a repository variable if needed.`);
  }
  return matches[0];
}

async function main() {
  if (!API_KEY) fail("Add OUTRANK_API_KEY as a GitHub Actions secret.");
  if (!/^[a-z0-9.-]+$/.test(EXPECTED_BLOG_DOMAIN)) fail("OUTRANK_EXPECTED_BLOG_DOMAIN is invalid.");

  const baseSha = process.env.PR_BASE_SHA;
  const mergeSha = process.env.PR_MERGE_SHA;
  if (!baseSha || !mergeSha) fail("The workflow did not provide the pull request base and merge commit SHAs.");

  const productId = await resolveProductId();
  console.log(`Verified the Outrank blog product for ${EXPECTED_BLOG_DOMAIN}.`);

  const files = changedArticleFiles(baseSha, mergeSha);
  if (!files.length) {
    console.log("No added or modified LaunchRanked MDX article files were found in this merged PR.");
    return;
  }

  for (const file of files) {
    const post = extractArticle(file);
    console.log(`Publishing "${post.title}" from ${file} to ${EXPECTED_BLOG_DOMAIN}...`);

    const { response, payload } = await apiRequest(
      `${API_BASE}/products/${encodeURIComponent(productId)}/blog/posts`,
      { method: "POST", body: JSON.stringify(post) }
    );

    if (response.status === 409) {
      console.log(`Already exists on Outrank; skipped to avoid a duplicate: ${post.title}`);
      continue;
    }

    if (!response.ok) {
      fail(`Outrank rejected "${post.title}" (HTTP ${response.status}): ${JSON.stringify(payload).slice(0, 2000)}`);
    }

    const result = payload?.data ?? payload;
    const postUrl = result?.url || result?.post?.url || result?.permalink || "";
    console.log(postUrl ? `Published: ${postUrl}` : `Published successfully: ${post.title}`);
  }
}

main().catch((error) => fail(error?.stack || error?.message || String(error)));
