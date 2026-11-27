import { loadDictionary } from "@/lib/i18n.js";
import { sectionPath } from "@/lib/routes.js";

export default function NotFound() {
  const portuguese = loadDictionary("pt-br");
  const english = loadDictionary("en");
  return (
    <main id="content" className="gate">
      <h1>{english.notFound}</h1>
      <p>{portuguese.notFound}</p>
      <p>
        <a href={sectionPath("pt-br", "brazil")}>{portuguese.sections.brazil}</a>
        <a href={sectionPath("en", "brazil")}>{english.sections.brazil}</a>
      </p>
    </main>
  );
}
