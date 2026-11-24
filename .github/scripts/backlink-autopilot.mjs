import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data/backlink-autopilot");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const SUPPRESSIONS_FILE = path.join(DATA_DIR, "suppressions.json");
const APOLLO = "https://api.apollo.io/api/v1";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
};
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const state = readJson(STATE_FILE, { contacted: {}, discovered: {}, lastRun: null, stats: {} });
const suppressions = new Set(readJson(SUPPRESSIONS_FILE, []).map((x) => String(x).toLowerCase()));
const log = (message) => console.log(`[backlink-autopilot] ${message}`);
const enabled = String(process.env.OUTREACH_SEND_ENABLED || "").toLowerCase() === "true";
const maxEmails = Math.min(5, Math.max(0, Number(process.env.OUTREACH_MAX_EMAILS_PER_RUN || 5)));

function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing required GitHub secrets/variables: ${missing.join(", ")}`);
}

async function apollo(pathname, body) {
  const response = await fetch(`${APOLLO}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": process.env.APOLLO_API_KEY, Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Apollo HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 1000)}`);
  return payload;
}

function getDomain(person) {
  const org = person.organization || {};
  const raw = org.primary_domain || org.website_url || org.domain || "";
  try { return new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
}

function candidateScore(person) {
  const title = String(person.title || "").toLowerCase();
  const company = String(person.organization?.name || "").toLowerCase();
  const relevantTitles = ["editor", "founder", "owner", "publisher", "content", "marketing", "webmaster", "community", "partnership"];
  const relevantTopics = ["design", "web", "creative", "digital", "software", "developer", "agency", "technology", "css", "frontend"];
  return (relevantTitles.some((x) => title.includes(x)) ? 2 : 0) +
    (relevantTopics.some((x) => company.includes(x)) ? 2 : 0);
}

async function discover() {
  const queries = [
    "web design development agency",
    "CSS frontend developer resources",
    "design tools creative software publisher"
  ];
  const people = new Map();
  for (const keyword of queries) {
    const payload = await apollo("/mixed_people/api_search", {
      q_keywords: keyword,
      person_titles: ["Editor", "Founder", "Owner", "Content Manager", "Marketing Manager", "Partnerships Manager", "Webmaster"],
      person_seniorities: ["owner", "founder", "head", "director", "manager"],
      contact_email_status: ["verified"],
      per_page: 25,
      page: 1
    });
    for (const person of (payload.people || payload.contacts || [])) {
      const id = person.id || person.person_id;
      if (id && !people.has(id)) people.set(id, person);
    }
  }
  return [...people.values()]
    .map((person) => ({ person, domain: getDomain(person), score: candidateScore(person) }))
    .filter((x) => x.domain && x.domain !== "animatedbackgrounds.me" && x.score >= 2)
    .filter((x) => !state.discovered[x.domain]);
}

async function enrich(candidates) {
  const output = [];
  for (let i = 0; i < candidates.length; i += 10) {
    const batch = candidates.slice(i, i + 10);
    const details = batch.map(({ person, domain }) => ({
      first_name: person.first_name,
      last_name: person.last_name,
      domain
    }));
    const payload = await apollo("/people/bulk_match", { details, reveal_personal_emails: false });
    const matches = payload.matches || [];
    for (let j = 0; j < batch.length; j++) {
      const match = matches[j] || {};
      const email = String(match.email || "").toLowerCase();
      const emailStatus = String(match.email_status || "").toLowerCase();
      const candidate = batch[j];
      if (!email || emailStatus !== "verified" || suppressions.has(email) || state.contacted[email]) continue;
      if (email.split("@")[1] !== candidate.domain) continue;
      output.push({ ...candidate, match, email });
    }
  }
  return output;
}

async function gmailAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token"
    }),
    signal: AbortSignal.timeout(30000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(`Google OAuth failed: ${JSON.stringify(payload).slice(0, 1000)}`);
  return payload.access_token;
}

function b64url(value) {
  return Buffer.from(value, "utf8").toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function makeEmail(candidate) {
  const firstName = String(candidate.match.first_name || candidate.person.first_name || "there").trim();
  const company = String(candidate.person.organization?.name || candidate.domain).trim();
  const subject = "A resource suggestion for your web design audience";
  const body = [
    `Hi ${firstName},`,
    "",
    `I came across ${company} while researching resources for web designers and frontend developers.`,
    "",
    "I run AnimatedBackgrounds.me, a library of 650+ CSS and animated backgrounds that designers and developers can use in websites and projects.",
    "",
    "If you maintain a tools, resources, or inspiration page, would you consider reviewing it as a possible resource? Only if it is genuinely useful to your audience.",
    "",
    "Website: https://animatedbackgrounds.me",
    "",
    "If this isn't relevant, just reply and I won't contact you again.",
    "",
    `— ${process.env.OUTREACH_FROM_NAME}`,
    `Reply to: ${process.env.OUTREACH_REPLY_TO}`,
    `Business address: ${process.env.OUTREACH_POSTAL_ADDRESS}`,
    `To opt out of future emails, reply with "unsubscribe" or email ${process.env.OUTREACH_UNSUBSCRIBE_EMAIL}.`
  ].join("\r\n");
  const mime = [
    `From: ${process.env.OUTREACH_FROM_NAME} <${process.env.OUTREACH_REPLY_TO}>`,
    `To: ${candidate.email}`,
    `Reply-To: ${process.env.OUTREACH_REPLY_TO}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    body
  ].join("\r\n");
  return { subject, raw: b64url(mime) };
}

async function sendEmail(token, candidate) {
  const message = makeEmail(candidate);
  const response = await fetch(GMAIL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: message.raw }),
    signal: AbortSignal.timeout(30000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Gmail HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 1000)}`);
  return payload;
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  requireEnv(["APOLLO_API_KEY"]);
  if (enabled) {
    requireEnv(["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "OUTREACH_FROM_NAME", "OUTREACH_REPLY_TO", "OUTREACH_UNSUBSCRIBE_EMAIL", "OUTREACH_POSTAL_ADDRESS"]);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.OUTREACH_REPLY_TO)) throw new Error("OUTREACH_REPLY_TO must be a valid email address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.OUTREACH_UNSUBSCRIBE_EMAIL)) throw new Error("OUTREACH_UNSUBSCRIBE_EMAIL must be a valid email address.");
    if (process.env.OUTREACH_POSTAL_ADDRESS.trim().length < 10) throw new Error("OUTREACH_POSTAL_ADDRESS must contain a complete postal address.");
  }

  log("Discovering relevant publishing and web-design contacts with Apollo.");
  const candidates = await discover();
  log(`Found ${candidates.length} new relevant contact candidates.`);
  const enriched = await enrich(candidates.slice(0, 10));
  log(`${enriched.length} candidates have verified business email addresses.`);

  let sent = 0;
  if (enabled && maxEmails > 0 && enriched.length) {
    const token = await gmailAccessToken();
    for (const candidate of enriched.slice(0, maxEmails)) {
      const result = await sendEmail(token, candidate);
      state.contacted[candidate.email] = {
        domain: candidate.domain,
        person: [candidate.match.first_name, candidate.match.last_name].filter(Boolean).join(" "),
        sentAt: new Date().toISOString(),
        gmailMessageId: result.id || null,
        status: "contacted"
      };
      state.discovered[candidate.domain] = new Date().toISOString();
      sent += 1;
      log(`Sent one partnership enquiry to ${candidate.domain}.`);
    }
  } else {
    log("Send mode is disabled or there are no verified contacts. No email was sent.");
  }

  state.lastRun = new Date().toISOString();
  state.stats = { discovered: candidates.length, verified: enriched.length, sent, mode: enabled ? "send" : "discovery-only" };
  writeJson(STATE_FILE, state);
  log(`Run complete: ${sent} emails sent.`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
