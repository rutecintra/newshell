# News, explained

A static Portuguese edition of short news explanations. Brazil opens the site. World keeps up to three highlights, then the latest stories. Search and filters live in the page address. English stays off while the Groq free plan is in use.

## Publication flow

A headline becomes a public story only after a person checks the original report and merges it to `main`.

```mermaid
flowchart TD
  sources["config/sources.json"] --> collect["collect workflow"]
  collect --> queue["queue branch: queue/pending.json"]
  queue --> draft["draft workflow"]
  draft --> extract["Trafilatura reads the article"]
  extract --> groq["Groq writes the Portuguese draft"]
  groq --> pull["Pull request with status published"]
  pull --> review["Reviewer checks the original report"]
  review --> publish["Merge the pull request"]
  publish --> ci["ci workflow"]
  publish --> vercel["Vercel deploys main"]
  vercel --> site["Public edition"]
```

1. **Collect.** The `collect` workflow runs at minutes 17 and 47, or from the Actions tab. It reads the feeds in `config/sources.json` and, when a headline is new, commits title, date, and link to `queue/pending.json` on the `queue` branch. The article text stays out of the repository. This branch does not deploy.
2. **Draft.** The `draft` workflow runs daily at 12:20 UTC, or from the Actions tab. It takes up to one queued headline, extracts the article with Trafilatura, and asks Groq for the Portuguese explanation. It opens a pull request with `status: "published"`.
3. **Review.** Open the original report linked in the story. Check the date, the numbers, and the stage. Approving the pull request is the decision to publish.
4. **Publish.** Merge the pull request into `main`. The `ci` workflow validates the content and builds the site. Vercel deploys `main`. The story appears on [newshell-eight.vercel.app](https://newshell-eight.vercel.app). A later correction stays at the same address.

`GROQ_API_KEY` must exist as an Actions secret before the draft workflow can call Groq.

## Local check

```bash
npm ci
npm test
npm run validate:content
npm run build
npm start
```

Open `http://localhost:8080/pt-br/brasil/` and reload a story.

`SITE_URL` is the public `https` origin used in shared links and social previews. Local builds fall back to `http://localhost:8080`. On Vercel, `SITE_URL` wins when it is set; otherwise the build uses `VERCEL_PROJECT_PRODUCTION_URL`.

## Deploy

The Vercel project should track `main` on the Hobby plan.

- Framework preset: Other
- Install command: `npm ci`
- Build command: `npm run validate:content && npm run build`
- Output directory: `out`
- Node.js: 24

`vercel.json` already carries those commands. Builds for branches other than `main`, including `queue`, are ignored. Pull requests are checked by GitHub Actions.

## Edition files

Approved stories live in `content/stories/<id>/` with `meta.json` and `pt-br.md`. Interface copy is in `locales/pt-br.json`. Feed registration is `config/sources.json`.

`python3 scripts/collect.py` stores headlines, dates, and links in `queue/`. It does not store full articles. The scheduled workflow commits that queue on the `queue` branch only when the metadata changes.

`python3 scripts/draft.py` reads the `queue` branch, extracts the article with Trafilatura, and asks Groq for a Portuguese draft. The article text is not committed. New stories are saved with `status: "published"`. The `draft` workflow opens a pull request, and merging it publishes them.

Create a free key at [console.groq.com](https://console.groq.com/) and save it as the Actions secret `GROQ_API_KEY`. `GROQ_MODEL` defaults to `openai/gpt-oss-20b`. The workflow drafts one story per run.

## Fonts

Newsreader and Source Sans 3 are stored in `app/fonts/` with their OFL licenses.
