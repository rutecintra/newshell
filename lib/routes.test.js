import assert from "node:assert/strict";
import test from "node:test";
import { sectionPath, storyPath, switchLocalePath } from "./routes.js";

test("section and story paths stay on the portuguese edition", () => {
  assert.equal(sectionPath("pt-br", "brazil"), "/pt-br/brasil/");
  assert.equal(sectionPath("pt-br", "world"), "/pt-br/mundo/");
  assert.equal(storyPath("pt-br", "q-9e07bc4a31bf1d56"), "/pt-br/noticia/q-9e07bc4a31bf1d56/");
  assert.equal(
    switchLocalePath("/pt-br/noticia/q-9e07bc4a31bf1d56/", "?topic=education", "pt-br"),
    "/pt-br/noticia/q-9e07bc4a31bf1d56/?topic=education",
  );
  assert.equal(switchLocalePath("/pt-br/mundo/", "?country=AR", "pt-br"), "/pt-br/mundo/?country=AR");
});
