# Integrations

## LaunchRanked → Outrank (recommended)

This route uses GitHub Actions and posts directly to the Outrank-hosted blog at `blog.animatedbackgrounds.me`. It needs **no additional hosting**.

### One-time setup

1. In Outrank, open your account menu → **API Keys** and create an API key.
2. In GitHub, open this repository → **Settings → Secrets and variables → Actions → New repository secret**.
3. Name the secret `OUTRANK_API_KEY` and paste the Outrank key as its value. Do not commit the key to the repository.
4. Open the repository's **Actions** tab, choose **Check Outrank API access**, then click **Run workflow**. This is a read-only check: it verifies the key, reports the `blog` entitlement, and checks which product exposes `blog.animatedbackgrounds.me`.
5. In LaunchRanked → **Settings → Publishing**, choose **GitHub PR** and connect `Prakhar826/Animatedbackgrounds` if LaunchRanked confirms that GitHub PR is the supported route for your Outrank-hosted blog. Use `main` as the target branch if requested.
6. The current publisher expects one MDX article per PR under `content/blog/` (for example, `content/blog/an-article-slug.mdx`). Inspect the first PR before merging; we must verify its path and frontmatter match the publisher.

### How publishing works

- LaunchRanked opens an article PR. Nothing is published yet.
- Review the article and merge the PR into `main`.
- The workflow verifies that the selected Outrank product's hosted blog is `blog.animatedbackgrounds.me`, then calls Outrank's hosted-blog API with the article and `status: published`.
- Outrank's duplicate-slug protection prevents a retry from creating a second copy.

For the first article, leave the PR open until its exact MDX/frontmatter format has been checked. The publisher supports title/description/tags/category from common frontmatter fields and a Markdown H1, but we should confirm the first generated file before its first merge.

### GitHub settings

- Required repository secret: `OUTRANK_API_KEY`
- The publishing workflow is pinned to the verified Animated Backgrounds Outrank product and checks `blog.animatedbackgrounds.me` before publishing.
- Manual diagnostic: **Actions → Check Outrank API access → Run workflow**. The check performs GET requests only and never creates or publishes posts.

### Safety boundaries

- Only a PR merged into `main` can publish.
- Only files in `content/blog/*.mdx` are considered.
- Changes to the main website, its deployment archive, or the existing website deployment workflow do not trigger this publishing workflow.
- No Netlify site or other hosting is required.

## Optional webhook prototype

`launchranked-outrank-bridge/` contains an older Netlify webhook-inbox prototype. It is not required for the GitHub Actions route and should remain undeployed unless you explicitly choose the webhook approach.
