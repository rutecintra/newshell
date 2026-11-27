import assert from "node:assert/strict";
import test from "node:test";
import { sectionPath, storyPath, switchLocalePath } from "./routes.js";

test("section and story paths stay stable across languages", () => {
  assert.equal(sectionPath("pt-br", "brazil"), "/pt-br/brasil/");
  assert.equal(sectionPath("en", "world"), "/en/world/");
  assert.equal(storyPath("pt-br", "sample-school-meals-ar"), "/pt-br/noticia/sample-school-meals-ar/");
  assert.equal(
    switchLocalePath("/pt-br/noticia/sample-school-meals-ar/", "?topic=education", "en"),
    "/en/story/sample-school-meals-ar/?topic=education",
  );
  assert.equal(switchLocalePath("/en/world/", "?country=AR", "pt-br"), "/pt-br/mundo/?country=AR");
});
