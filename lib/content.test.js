import assert from "node:assert/strict";
import test from "node:test";
import { explanationWordCount, loadStories } from "./content.js";

test("sample stories explain the same fact in both languages", () => {
  const stories = loadStories();
  assert.equal(stories.length, 3);
  const meals = stories.find((story) => story.id === "sample-school-meals-ar");
  assert.ok(meals);
  assert.ok(explanationWordCount(meals.locales.en.blocks) >= 80);
  assert.ok(explanationWordCount(meals.locales["pt-br"].blocks) >= 80);
  assert.ok(meals.countries.includes("AR"));
  assert.ok(meals.topics.includes("education"));
});
