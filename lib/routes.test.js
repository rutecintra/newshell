import assert from "node:assert/strict";
import test from "node:test";
import { sectionPath, storyPath, switchLocalePath } from "./routes.js";

test("section and story paths stay stable across languages", () => {
  assert.equal(sectionPath("pt-br", "brazil"), "/pt-br/brasil/");
  assert.equal(sectionPath("en", "world"), "/en/world/");
  assert.equal(storyPath("pt-br", "q-9e07bc4a31bf1d56"), "/pt-br/noticia/q-9e07bc4a31bf1d56/");
  assert.equal(
    switchLocalePath("/pt-br/noticia/q-9e07bc4a31bf1d56/", "?topic=education", "en"),
    "/en/story/q-9e07bc4a31bf1d56/?topic=education",
  );
  assert.equal(switchLocalePath("/en/world/", "?country=AR", "pt-br"), "/pt-br/mundo/?country=AR");
});
