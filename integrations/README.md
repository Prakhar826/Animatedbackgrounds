# Integrations

The recommended LaunchRanked → Outrank route is GitHub PR + GitHub Actions:

1. LaunchRanked opens one PR per article under `content/blog/*.mdx`.
2. Review the PR and merge it into `main`.
3. GitHub Actions sends the approved article directly to the Outrank hosted blog at `blog.animatedbackgrounds.me`.

No extra hosting is needed. The Netlify webhook bridge in `launchranked-outrank-bridge/` is an unused alternative prototype; it is not required for this GitHub Actions route.
