# Integrations

## LaunchRanked → Outrank (recommended)

This route uses GitHub Actions and posts directly to the Outrank-hosted blog at `blog.animatedbackgrounds.me`. It needs **no additional hosting**.

### One-time setup

1. In Outrank, open your account menu → **API Keys** and create an API key.
2. In GitHub, open this repository → **Settings → Secrets and variables → Actions → New repository secret**.
3. Name the secret `OUTRANK_API_KEY` and paste the Outrank key as its value. Do not commit the key to the repository.
4. In LaunchRanked → **Settings → Publishing**, choose **GitHub PR** and connect `Prakhar826/Animatedbackgrounds`. Use `main` as the target branch if LaunchRanked asks for one.
5. LaunchRanked's example GitHub output uses one MDX file per PR under `content/blog/` (for example, `content/blog/an-article-slug.mdx`). The workflow listens only for merged PRs that change MDX files in that folder.

### How publishing works

- LaunchRanked opens an article PR. Nothing is published yet.
- Review the article and merge the PR into `main`.
- The workflow verifies that the selected Outrank product's hosted blog is `blog.animatedbackgrounds.me`, then calls Outrank's hosted-blog API with the article and `status: published`.
- Outrank's duplicate-slug protection prevents a retry from creating a second copy.

For the first article, leave the PR open until its exact MDX/frontmatter format has been checked. The publisher supports title/description/tags/category from common frontmatter fields and a Markdown H1, but we should confirm the first generated file before its first merge.

### GitHub settings

- Required repository secret: `OUTRANK_API_KEY`
- Optional repository variable: `OUTRANK_PRODUCT_ID` (only needed if the API key covers multiple Outrank products and automatic matching cannot uniquely identify `blog.animatedbackgrounds.me`).

### Safety boundaries

- Only a PR merged into `main` can publish.
- Only files in `content/blog/*.mdx` are considered.
- Changes to the main website, its deployment archive, or the existing website deployment workflow do not trigger this publishing workflow.
- No Netlify site or other hosting is required.

## Optional webhook prototype

`launchranked-outrank-bridge/` contains an older Netlify webhook-inbox prototype. It is not required for the GitHub Actions route and should remain undeployed unless you explicitly choose the webhook approach.
