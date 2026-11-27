import fs from "node:fs";
import path from "node:path";
import { loadStories, toIndexEntry } from "../lib/content.js";
import { LOCALES, SECTIONS } from "../lib/search.js";

const stories = loadStories();
const root = path.join(process.cwd(), "public", "indexes");

for (const locale of LOCALES) {
  for (const section of SECTIONS) {
    const entries = stories
      .filter((story) => story.sections.includes(section))
      .map((story) => toIndexEntry(story, locale))
      .sort((a, b) => b.sourcePublishedAt.localeCompare(a.sourcePublishedAt));
    const dir = path.join(root, locale);
    fs.mkdirSync(dir, { recursive: true });
    const payload = {
      locale,
      section,
      orderedBy: "source-publication",
      stories: entries,
    };
    fs.writeFileSync(path.join(dir, `${section}.json`), `${JSON.stringify(payload)}\n`);
  }
}
