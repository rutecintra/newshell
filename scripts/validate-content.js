import fs from "node:fs";
import path from "node:path";
import {
  EXPLANATION_KEYS,
  explanationWordCount,
  loadStories,
  storiesRoot,
} from "../lib/content.js";
import {
  LOCALES,
  PLACEMENTS,
  SECTIONS,
  SOURCE_KINDS,
  STAGES,
  STATUSES,
  SUBTOPICS,
  TOPICS,
  VISUAL_TYPES,
} from "../lib/search.js";
import { getSiteUrl } from "../lib/site.js";

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function isIso(value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value);
}

function isId(value) {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isCountry(value) {
  return value === "INT" || /^[A-Z]{2}$/.test(value);
}

function isHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function sentenceCount(value) {
  return (String(value).match(/[.!?](?:\s|$)/g) || []).length;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function checkSourcesFile() {
  const file = path.join(process.cwd(), "config", "sources.json");
  const config = readJson(file);
  if (!Array.isArray(config.sources) || config.sources.length === 0) {
    fail("config/sources.json needs at least one source");
    return;
  }
  const ids = new Set();
  for (const source of config.sources) {
    const where = `source ${source.id || "(missing id)"}`;
    if (!isId(source.id)) fail(`${where}: id must be kebab-case`);
    if (ids.has(source.id)) fail(`${where}: duplicate id`);
    ids.add(source.id);
    if (!source.outlet) fail(`${where}: outlet is required`);
    if (!isHttps(source.feedUrl)) fail(`${where}: feedUrl must be https`);
    if (!LOCALES.includes(source.language)) fail(`${where}: language is not supported`);
    if (!Array.isArray(source.coverage) || source.coverage.some((item) => !SECTIONS.includes(item))) {
      fail(`${where}: coverage must list brazil and/or world`);
    }
    if (!Array.isArray(source.topics) || source.topics.some((item) => !TOPICS.includes(item))) {
      fail(`${where}: topics are invalid`);
    }
    if (!source.termsNote) fail(`${where}: termsNote is required`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.termsCheckedAt || "")) {
      fail(`${where}: termsCheckedAt must be YYYY-MM-DD`);
    }
  }
}

function checkVisual(story, visual) {
  const where = `${story.id} visual ${visual.id || "(missing id)"}`;
  if (!isId(visual.id)) fail(`${where}: id must be kebab-case`);
  if (!VISUAL_TYPES.includes(visual.type)) fail(`${where}: unknown type`);
  if (!story.sources.some((source) => source.id === visual.sourceId)) {
    fail(`${where}: sourceId does not match a source`);
  }
  if (!PLACEMENTS.includes(visual.after)) fail(`${where}: after must be an explanation section`);
  for (const locale of LOCALES) {
    const copy = visual.locales?.[locale];
    if (!copy?.title || !copy.caption || !copy.alt || !copy.labels) {
      fail(`${where}: ${locale} needs title, caption, alt, and labels`);
    }
  }
  const labels = visual.locales?.en?.labels || {};
  if (visual.type === "bars" || visual.type === "line") {
    const rows = visual.type === "bars" ? visual.series : visual.points;
    if (!Array.isArray(rows) || rows.length < 2) fail(`${where}: needs at least two values`);
    if (!visual.unit) fail(`${where}: unit is required`);
    for (const row of rows || []) {
      if (!isId(row.id) || typeof row.value !== "number" || Number.isNaN(row.value)) {
        fail(`${where}: each value needs an id and a number`);
      }
      if (!labels[row.id]) fail(`${where}: missing label for ${row.id}`);
    }
    for (const locale of LOCALES) {
      if (!visual.locales?.[locale]?.period) fail(`${where}: ${locale} period is required`);
    }
  }
  if (visual.type === "timeline") {
    if (!Array.isArray(visual.events) || visual.events.length === 0) fail(`${where}: events are required`);
    for (const event of visual.events || []) {
      if (!isId(event.id) || !isIso(event.at)) fail(`${where}: event ${event.id} needs an id and a UTC date`);
      if (event.state !== "occurred" && event.state !== "expected") {
        fail(`${where}: event ${event.id} state must be occurred or expected`);
      }
      if (!labels[event.id]) fail(`${where}: missing label for ${event.id}`);
    }
  }
  if (visual.type === "discussion" || visual.type === "rule-change") {
    const left = visual.type === "discussion" ? visual.discussed : visual.today;
    const right = visual.type === "discussion" ? visual.undefinedItems : visual.proposal;
    if (!Array.isArray(left) || left.length === 0 || !Array.isArray(right) || right.length === 0) {
      fail(`${where}: both columns need items`);
    }
    for (const item of [...(left || []), ...(right || [])]) {
      if (!labels[item]) fail(`${where}: missing label for ${item}`);
    }
    for (const locale of LOCALES) {
      const copy = visual.locales?.[locale];
      if (!copy?.leftHeading || !copy?.rightHeading) {
        fail(`${where}: ${locale} needs both column headings`);
      }
    }
  }
}

function checkStory(story) {
  const where = story.id || "(missing id)";
  if (!isId(story.id)) fail(`${where}: id must be kebab-case`);
  if (story.folderId !== story.id) fail(`${where}: folder name must match id`);
  if (!STATUSES.includes(story.status)) fail(`${where}: status must be sample, draft, or published`);
  if (!Array.isArray(story.sections) || story.sections.length === 0 || story.sections.some((item) => !SECTIONS.includes(item))) {
    fail(`${where}: sections are invalid`);
  }
  if (!Array.isArray(story.countries) || story.countries.some((item) => !isCountry(item))) {
    fail(`${where}: countries must be ISO codes or INT`);
  }
  if (!Array.isArray(story.topics) || story.topics.length === 0 || story.topics.some((item) => !TOPICS.includes(item))) {
    fail(`${where}: topics are invalid`);
  }
  if (!Array.isArray(story.subtopics) || story.subtopics.some((item) => !SUBTOPICS.includes(item))) {
    fail(`${where}: subtopics are invalid`);
  }
  if (!STAGES.includes(story.stage)) fail(`${where}: stage is invalid`);
  if (!isIso(story.publishedAt) || !isIso(story.updatedAt)) fail(`${where}: publishedAt and updatedAt must be UTC`);
  if (story.eventAt !== null && !isIso(story.eventAt)) fail(`${where}: eventAt must be null or UTC`);
  if (story.dateBasis !== "source-publication" && story.dateBasis !== "event") {
    fail(`${where}: dateBasis is invalid`);
  }
  if (story.featured !== null) {
    if (!story.featured || !isIso(story.featured.until) || !Number.isInteger(story.featured.rank)) {
      fail(`${where}: featured needs until and an integer rank`);
    }
  }
  if (!Array.isArray(story.sources) || story.sources.length === 0) fail(`${where}: sources are required`);
  if (!story.sources.some((source) => source.kind === "report")) fail(`${where}: one source must be a report`);
  const sourceIds = new Set();
  for (const source of story.sources || []) {
    const label = `${where} source ${source.id || "(missing id)"}`;
    if (!isId(source.id)) fail(`${label}: id must be kebab-case`);
    if (sourceIds.has(source.id)) fail(`${label}: duplicate id`);
    sourceIds.add(source.id);
    if (!source.outlet) fail(`${label}: outlet is required`);
    if (!isHttps(source.url)) fail(`${label}: url must be https`);
    if (!/^[a-z]{2}(?:-[a-z]{2})?$/.test(source.language || "")) fail(`${label}: language code is invalid`);
    if (!SOURCE_KINDS.includes(source.kind)) fail(`${label}: kind is invalid`);
    if (!isIso(source.publishedAt)) fail(`${label}: publishedAt must be UTC`);
    if (story.status === "published" && new URL(source.url).hostname === "example.com") {
      fail(`${label}: a published story cannot cite example.com`);
    }
  }
  for (const locale of LOCALES) {
    const copy = story.locales[locale];
    if (!copy?.title || !copy.description || !isIso(copy.reviewedAt)) {
      fail(`${where}: ${locale} needs title, description, and reviewedAt`);
      continue;
    }
    if (sentenceCount(copy.description) < 2) {
      fail(`${where}: ${locale} description needs two sentences`);
    }
    for (const key of EXPLANATION_KEYS) {
      if (!copy.blocks[key] || copy.blocks[key].length === 0) {
        fail(`${where}: ${locale} is missing ${key}`);
      }
    }
    const words = explanationWordCount(copy.blocks);
    if (words < 80) fail(`${where}: ${locale} explanation has ${words} words, minimum is 80`);
    if (words < 150 || words > 300) {
      warn(`${where}: ${locale} explanation has ${words} words; the editorial target is 150 to 300`);
    }
  }
  for (const visual of story.visuals || []) checkVisual(story, visual);
  if (!Array.isArray(story.corrections)) fail(`${where}: corrections must be a list`);
  for (const correction of story.corrections || []) {
    if (!isIso(correction.at)) fail(`${where}: each correction needs a UTC date`);
    for (const locale of LOCALES) {
      if (!correction.summary?.[locale]) fail(`${where}: correction is missing a ${locale} summary`);
    }
  }
}

function checkMarkdownFiles() {
  for (const id of fs.readdirSync(storiesRoot())) {
    const dir = path.join(storiesRoot(), id);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const locale of LOCALES) {
      const file = path.join(dir, `${locale}.md`);
      if (!fs.existsSync(file)) {
        fail(`${id}: missing ${locale}.md`);
        continue;
      }
      const markdown = fs.readFileSync(file, "utf8");
      if (/<[a-z!/]/i.test(markdown)) fail(`${id}: ${locale}.md cannot contain HTML`);
    }
  }
}

if (process.env.VERCEL === "1" && getSiteUrl().startsWith("http://localhost")) {
  fail("Set SITE_URL to the public https address so shared links and previews stay stable");
}

checkSourcesFile();
checkMarkdownFiles();

let stories = [];
try {
  stories = loadStories();
} catch (error) {
  fail(`could not read stories: ${error.message}`);
}

const ids = new Set();
for (const story of stories) {
  if (ids.has(story.id)) fail(`${story.id}: duplicate story id`);
  ids.add(story.id);
  checkStory(story);
}

for (const warning of warnings) console.warn(`warning: ${warning}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`error: ${error}`);
  process.exit(1);
}
console.log(`validated ${stories.length} stories`);
