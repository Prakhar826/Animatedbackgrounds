# AnimatedBackgrounds.me backlink autopilot

This workflow runs daily at 09:00 India Standard Time and can also be started manually from GitHub Actions.

## Current implementation

- Apollo People Search discovers contacts with relevant publishing, web-design, frontend, and marketing roles.
- Apollo Bulk People Enrichment retrieves work-email data. The workflow accepts only verified business emails and never requests personal emails or phone numbers.
- Gmail API sends a personalised, plain-text resource suggestion.
- State is persisted in `data/backlink-autopilot/state.json`; opted-out addresses belong in `data/backlink-autopilot/suppressions.json`.
- Sending is disabled unless `OUTREACH_SEND_ENABLED=true`.
- The workflow caps sends at five per run even if a higher value is configured.

## GitHub configuration

Add these repository **Actions secrets**:

| Secret | Purpose |
|---|---|
| `APOLLO_API_KEY` | Apollo API key |
| `GMAIL_CLIENT_ID` | Google OAuth client ID |
| `GMAIL_CLIENT_SECRET` | Google OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | Offline Gmail OAuth refresh token |

Add these repository **Actions variables**:

| Variable | Purpose |
|---|---|
| `OUTREACH_SEND_ENABLED` | Set to `true` only after validating the first discovery run and sender details |
| `OUTREACH_FROM_NAME` | Sender display name |
| `OUTREACH_REPLY_TO` | Authenticated Gmail mailbox / reply-to address |
| `OUTREACH_UNSUBSCRIBE_EMAIL` | Monitored opt-out mailbox |
| `OUTREACH_POSTAL_ADDRESS` | Valid business mailing address for the email footer |
| `OUTREACH_MAX_EMAILS_PER_RUN` | Maximum daily send count; hard-capped at five |

Gmail OAuth must be configured for the Gmail API with the `https://www.googleapis.com/auth/gmail.send` scope and offline access. Store the refresh token only as a GitHub Actions secret.

## First-run checklist

1. Add `APOLLO_API_KEY` and run **Actions → Backlink autopilot → Run workflow**.
2. Inspect the workflow log and the persisted state. Apollo People Search does not return email addresses; enrichment can consume Apollo credits.
3. Configure Gmail OAuth and the sender variables.
4. Keep `OUTREACH_SEND_ENABLED` false until the sender identity, postal address, opt-out inbox, and email copy are correct.
5. Set it to true to enable the daily send schedule.

## Important limitations — do not mistake these for completed integrations

- **Ahrefs DR gate is not connected yet.** The current workflow does not claim to measure DR or guarantee that a prospect's domain meets a DR threshold. Add a supported Ahrefs API entitlement and test its current API endpoint/response before enabling a DR filter.
- Apollo is a contact-discovery/enrichment source, not a verified publisher-directory database. Review the first discovery results to ensure the account's search filters produce relevant editors and resource-page owners.
- The current version sends initial enquiries only. Automated follow-ups, reply classification, bounce handling, and opt-out ingestion need to be added before describing the outreach lifecycle as fully autonomous.
- Do not use this for bulk unsolicited mail. Follow applicable privacy, anti-spam, and email-provider policies. Honour opt-outs promptly. Do not contact personal addresses or addresses on the suppression list.
- The existing Outrank publishing workflow remains separate and unchanged.
