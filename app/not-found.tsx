import { loadDictionary } from "@/lib/i18n.js";
import { sectionPath } from "@/lib/routes.js";

export default function NotFound() {
  const dict = loadDictionary("pt-br");
  return (
    <main id="content" className="gate">
      <h1>{dict.notFound}</h1>
      <p>
        <a href={sectionPath("pt-br", "brazil")}>{dict.sections.brazil}</a>
      </p>
    </main>
  );
}
