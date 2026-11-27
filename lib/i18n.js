import fs from "node:fs";
import path from "node:path";

export function loadDictionary(locale) {
  const file = path.join(process.cwd(), "locales", `${locale}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
