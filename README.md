# News, explained

A static bilingual edition of short news explanations. Brazil opens the site. World keeps up to three highlights, then the latest stories. Search and filters live in the page address.

The stories in this repository are layout samples. They are not reviewed journalism.

## Local check

```bash
npm ci
npm test
npm run validate:content
npm run build
npm start
```

Open `http://localhost:8080/pt-br/brasil/`, reload a story, and switch between Português and English.

`SITE_URL` is the public `https` origin used in shared links and social previews. Local builds fall back to `http://localhost:8080`. On Vercel, `SITE_URL` wins when it is set; otherwise the build uses `VERCEL_PROJECT_PRODUCTION_URL`.

## Deploy

The Vercel project should track `main` on the Hobby plan.

- Framework preset: Other
- Install command: `npm ci`
- Build command: `npm run validate:content && npm run build`
- Output directory: `out`
- Node.js: 24

`vercel.json` already carries those commands. Builds for branches other than `main`, including `coleta`, are ignored. Pull requests are checked by GitHub Actions.

## Edition files

Approved stories live in `content/stories/<id>/` with `meta.json`, `pt-br.md`, and `en.md`. Interface copy is in `locales/`. Feed registration is `config/sources.json`.

`python3 scripts/collect.py` stores headlines, dates, and links in `queue/`. It does not store full articles. The scheduled workflow commits that queue on the `coleta` branch only when the metadata changes.

`python3 scripts/draft.py` reads that queue, extracts the article with Trafilatura, and asks Groq for a bilingual draft. The article text is not committed. New stories are saved with `status: "draft"` and stay off the public edition. The `draft` workflow opens a pull request. Read the original report, then change `status` to `published` before merging.

Create a free key at [console.groq.com](https://console.groq.com/) and save it as the Actions secret `GROQ_API_KEY`. `GROQ_MODEL` defaults to `openai/gpt-oss-20b`. `DRAFT_LIMIT` defaults to 2 stories per run.

## Fonts

Newsreader and Source Sans 3 are stored in `app/fonts/` with their OFL licenses.
