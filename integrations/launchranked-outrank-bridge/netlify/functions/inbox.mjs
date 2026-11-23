import { getStore } from "@netlify/blobs";

const encoder = new TextEncoder();

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function safeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

export default async function readLaunchRankedInbox(request) {
  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const adminToken = process.env.BRIDGE_ADMIN_TOKEN;
  if (!adminToken) {
    return jsonResponse({ ok: false, error: "admin_token_not_configured" }, 503);
  }

  const authorization = request.headers.get("authorization") || "";
  const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!safeEqual(encoder.encode(suppliedToken).toString(), encoder.encode(adminToken).toString())) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  try {
    const store = getStore("launchranked-inbox");
    const { blobs } = await store.list({ prefix: "pending/" });
    const latest = blobs
      .sort((a, b) => b.key.localeCompare(a.key))
      .slice(0, 20);

    const events = await Promise.all(
      latest.map(async (blob) => ({
        key: blob.key,
        record: await store.get(blob.key, { type: "json" })
      }))
    );

    return jsonResponse({
      ok: true,
      count: events.length,
      events
    });
  } catch (error) {
    console.error("Could not read LaunchRanked inbox:", error?.message || "storage_error");
    return jsonResponse({ ok: false, error: "could_not_read_inbox" }, 503);
  }
}
