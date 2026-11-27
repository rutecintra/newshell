import assert from "node:assert/strict";
import test from "node:test";
import { fold, presentStories, storyMatches } from "./search.js";

const story = {
  id: "school",
  title: "Educação na Argentina",
  description: "Merenda escolar nesta amostra.",
  topics: ["education"],
  subtopics: [],
  countries: ["AR"],
  sourcePublishedAt: "2026-11-18T12:00:00Z",
  featured: { until: "2027-12-31T23:59:59Z", rank: 1 },
};

const empty = { q: "", topics: [], subtopics: [], countries: [] };

test("fold ignores case and accents", () => {
  assert.equal(fold("Educação"), "educacao");
});

test("blank search keeps the edition and words combine", () => {
  assert.equal(storyMatches(story, empty), true);
  assert.equal(storyMatches(story, { ...empty, q: "   " }), true);
  assert.equal(storyMatches(story, { ...empty, q: "educacao argentina" }), true);
  assert.equal(storyMatches(story, { ...empty, q: "zzzz" }), false);
});

test("topics combine with or and other filters with and", () => {
  assert.equal(storyMatches(story, { ...empty, topics: ["education", "politics"] }), true);
  assert.equal(storyMatches(story, { ...empty, topics: ["politics"] }), false);
  assert.equal(storyMatches(story, { ...empty, topics: ["education"], countries: ["AR"] }), true);
  assert.equal(storyMatches(story, { ...empty, topics: ["education"], countries: ["BR"] }), false);
});

test("a world highlight is not repeated in the latest list", () => {
  const later = { ...story, id: "later", title: "Later", featured: null, sourcePublishedAt: "2026-11-20T12:00:00Z" };
  const presented = presentStories([story, later], "world", empty, "2026-11-26T00:00:00Z");
  assert.deepEqual(
    presented.map((item) => [item.story.id, item.highlight]),
    [
      ["school", true],
      ["later", false],
    ],
  );
});
