# Yard Memory

A weekly memory of Jamaica. Every four hours it reads Jamaican newsrooms (and X, once switched on), groups the coverage into stories, ranks them by how much they matter and how far they travelled, and retells each one briefly with links to the original reporting. Each week is kept, so the site builds into an archive of what the country talked about.

## How it works

1. **Read.** `src/fetch-news.js` reads The Gleaner, Jamaica Observer and Nationwide 90FM through their RSS feeds, and RJR News and OUR Today through their homepages. Each new article page is visited once for the preview details the outlet publishes itself (share image, summary, publish time). Loop News is left out because its robots.txt disallows automated access. The crawler identifies itself and pauses between requests.
2. **Listen.** `src/fetch-x.js` reads recent public posts about Jamaica from the X API, when `X_BEARER_TOKEN` is set.
3. **Group.** `src/group.js` asks Claude (on Amazon Bedrock) which headlines report the same story, so five angles on one row in Parliament count as one story. Without AWS set up, `src/stories.js` groups headlines by shared words.
4. **Rank.** Each story is scored: **reach** (outlets carrying it) × 3, **weight** (national consequence) × 2.5, **heart** (human stakes) × 2, **talk** (engagement on X) × 1.5, plus up to 2 for freshness.
5. **Retell.** `src/retell.js` asks Claude for a headline, a short summary and two to four paragraphs, using only the outlets' headlines and summaries. Full articles are never copied. Retellings are cached, so a story is only retold again when new coverage joins it.
6. **Remember.** The week is saved to `data/weeks/<year>-W<week>.json` and committed. `src/build.js` turns every week into a page in `site/`.

## Setup

1. **Turn on GitHub Pages:** Settings → Pages → Source: **GitHub Actions**.
2. **Recommended: connect Amazon Bedrock** so Claude can group and retell stories. Without it the site still runs, using the outlets' own headlines and summaries.
   - In the AWS console, open Amazon Bedrock and make sure Claude Opus 5.5 is available to your account in your chosen region.
   - **Option A, no stored keys (recommended):** create an IAM role that GitHub can assume through OIDC (trust `token.actions.githubusercontent.com`, limited to `repo:da3ferg/yard-memory:*`) with permission to call Claude on Bedrock (the AWS managed `AmazonBedrockLimitedAccess` policy works, or the narrower permissions AWS documents for Claude on Bedrock). Add repository **variables** `AWS_ROLE_ARN` (the role's ARN) and `AWS_REGION` (for example `us-east-1`).
   - **Option B, access keys:** add **secrets** `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` for an IAM user with the same Bedrock permission, and the variable `AWS_REGION`.
   - Optional variable `BEDROCK_MODEL` changes the model (default `anthropic.claude-opus-5-5`).
3. **Optional:** add `X_BEARER_TOKEN` (an X API key with recent-search access, a paid X plan) to switch on the X pull and the "What X is saying" section.
4. Run the **Update Yard Memory** workflow from the Actions tab, or wait for the next scheduled run.

Other optional repository variables: `X_QUERY` (the X search), `MAX_STORIES` (default 30), `SHOW_PUBLISHER_IMAGES` (`false` replaces outlet photos with generated cover art).

## Images

By default each story shows the share image its outlet publishes for link previews, credited to the outlet and linked to its reporting, the way a link card on social media works. That is not a licence. If an outlet objects, or before using the site commercially, set `SHOW_PUBLISHER_IMAGES` to `false` or arrange permission.

## Run locally

```sh
npm install
npm test
npm run sample      # builds site/ from saved sample headlines, no network
AWS_REGION=us-east-1 AWS_PROFILE=you node src/run.js   # live run with Claude on Bedrock (add X_BEARER_TOKEN for X)
node src/build.js
```
