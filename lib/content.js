import fs from "node:fs";
import path from "node:path";
import { LOCALES } from "./search.js";

export const EXPLANATION_KEYS = [
  "what-happened",
  "in-plain-terms",
  "who-may-be-affected",
  "where-things-stand",
];

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g;

export function parseInline(input) {
  const spans = [];
  let cursor = 0;
  for (const match of input.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > cursor) spans.push({ type: "text", text: input.slice(cursor, index) });
    if (match[1] !== undefined) spans.push({ type: "strong", text: match[1] });
    else spans.push({ type: "link", text: match[2], href: match[3] });
    cursor = index + match[0].length;
  }
  if (cursor < input.length) spans.push({ type: "text", text: input.slice(cursor) });
  return spans.filter((span) => span.text !== "");
}

export function parseExplanation(markdown) {
  const matches = [...markdown.matchAll(/^##\s+([a-z0-9-]+)\s*$/gm)];
  const blocks = {};
  for (let index = 0; index < matches.length; index += 1) {
    const start = (matches[index].index ?? 0) + matches[index][0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : markdown.length;
    const paragraphs = markdown
      .slice(start, end)
      .trim()
      .split(/\n\s*\n/)
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .map(parseInline);
    blocks[matches[index][1]] = paragraphs;
  }
  return blocks;
}

export function explanationWordCount(blocks) {
  const text = EXPLANATION_KEYS.flatMap((key) => blocks[key] ?? [])
    .flat()
    .map((span) => span.text)
    .join(" ")
    .trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

export function storiesRoot() {
  return path.join(process.cwd(), "content", "stories");
}

export function loadStory(folderId) {
  const dir = path.join(storiesRoot(), folderId);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
  const locales = {};
  for (const locale of LOCALES) {
    const markdown = fs.readFileSync(path.join(dir, `${locale}.md`), "utf8");
    locales[locale] = {
      ...meta.locales[locale],
      blocks: parseExplanation(markdown),
    };
  }
  return { ...meta, id: meta.id, folderId, locales };
}

export function loadStories() {
  return fs
    .readdirSync(storiesRoot())
    .filter((name) => fs.statSync(path.join(storiesRoot(), name)).isDirectory())
    .sort()
    .map((id) => loadStory(id));
}

export function editionStories() {
  return loadStories().filter((story) => story.status !== "draft");
}

export function reportSource(story) {
  return story.sources.find((source) => source.kind === "report") ?? story.sources[0];
}

export function toIndexEntry(story, locale) {
  const copy = story.locales[locale];
  const report = reportSource(story);
  return {
    id: story.id,
    title: copy.title,
    description: copy.description,
    topics: story.topics,
    subtopics: story.subtopics,
    countries: story.countries,
    stage: story.stage,
    sourcePublishedAt: report.publishedAt,
    updatedAt: story.updatedAt,
    outlet: report.outlet,
    sourceUrl: report.url,
    sourceLanguage: report.language,
    featured: story.featured,
    status: story.status,
    sections: story.sections,
  };
}
