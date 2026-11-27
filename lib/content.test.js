import assert from "node:assert/strict";
import test from "node:test";
import { explanationWordCount, loadStories } from "./content.js";

test("published stories explain the fact in portuguese", () => {
  const stories = loadStories();
  assert.equal(stories.some((story) => story.status === "sample"), false);
  const story = stories.find((item) => item.status === "published");
  assert.ok(story);
  assert.equal(story.locales.en, undefined);
  assert.ok(explanationWordCount(story.locales["pt-br"].blocks) >= 80);
});
