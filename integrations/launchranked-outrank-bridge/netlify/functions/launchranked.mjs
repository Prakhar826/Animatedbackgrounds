import { getStore } from "@netlify/blobs";

const encoder = new TextEncoder();
const MAX_BODY_BYTES = 4 * 1024 * 1024;

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

async function hmacSha256Hex(secret, rawBody) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeKey(value) {
  return String(value || "event")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
}

export default async function launchRankedWebhook(request) {
  if (request.method === "GET") {
    return jsonResponse({
      ok: true,
      service: "launchranked-outrank-bridge",
      mode: "secure-inbox",
      message: "Webhook endpoint is ready."
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const rawBody = await request.text();
  if (encoder.encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: "payload_too_large" }, 413);
  }

  const signingSecret = process.env.LAUNCHRANKED_SIGNING_SECRET;
  if (!signingSecret) {
    return jsonResponse({ ok: false, error: "signing_secret_not_configured" }, 503);
  }

  const suppliedSignature = (request.headers.get("x-launchranked-signature") || "")
    .trim()
    .replace(/^sha256=/i, "")
    .toLowerCase();

  if (!suppliedSignature) {
    return jsonResponse({ ok: false, error: "missing_signature" }, 401);
  }

  const expectedSignature = await hmacSha256Hex(signingSecret, rawBody);
  if (!safeEqual(expectedSignature, suppliedSignature)) {
    return jsonResponse({ ok: false, error: "invalid_signature" }, 401);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const headerEvent = request.headers.get("x-launchranked-event");
  const eventName = String(payload?.event || headerEvent || "unknown");

  // LaunchRanked's connection test sends a ping. A valid signed ping is enough
  // to confirm that the endpoint is reachable and that signature validation works.
  if (eventName.toLowerCase() === "ping") {
    return jsonResponse({
      ok: true,
      event: "ping",
      received: true,
      site: payload?.site?.domain || null
    });
  }

  // The exact content-event schema is captured first rather than guessed.
  // This prevents a paid placement from being silently dropped or mis-published.
  const receivedAt = new Date().toISOString();
  const eventId = payload?.id || payload?.eventId || payload?.event_id || payload?.deliveryId || crypto.randomUUID();
  const record = {
    id: String(eventId),
    event: eventName,
    receivedAt,
    site: payload?.site || null,
    payload,
    rawBody,
    source: {
      userAgent: request.headers.get("user-agent") || null,
      eventHeader: headerEvent || null
    },
    status: "pending_mapping"
  };

  try {
    const store = getStore("launchranked-inbox");
    const key = "pending/" + Date.now() + "-" + safeKey(eventId) + "-" + crypto.randomUUID();
    await store.setJSON(key, record);
  } catch (error) {
    console.error("Could not persist LaunchRanked event:", error?.message || "storage_error");
    return jsonResponse({ ok: false, error: "could_not_store_event" }, 503);
  }

  return jsonResponse({
    ok: true,
    accepted: true,
    queued: true,
    event: eventName,
    message: "Event securely queued for publishing-field verification."
  }, 202);
}
