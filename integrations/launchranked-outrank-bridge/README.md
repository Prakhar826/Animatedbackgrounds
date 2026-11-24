# LaunchRanked–Outrank webhook bridge (alternative prototype)

**You do not need to deploy this service for the recommended GitHub PR workflow.** The GitHub Actions integration publishes directly from a merged LaunchRanked PR to Outrank, with no Netlify hosting.

This folder is retained as an optional alternative only. It is an isolated Netlify Functions prototype that receives signed LaunchRanked webhook requests and queues non-ping events for inspection. It does not publish articles by itself.

For the recommended no-hosting approach, see `/.github/workflows/launchranked-to-outrank.yml` and `/.github/scripts/publish-launchranked-article.mjs`.

Do not deploy this bridge unless you explicitly decide to use the webhook route instead.
