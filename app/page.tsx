import type { Metadata } from "next";
import { sectionPath } from "@/lib/routes.js";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "News, explained",
};

const redirectScript = `
try {
  var pref = localStorage.getItem("locale");
  var locale = pref === "en" ? "en" : "pt-br";
  var section = locale === "en" ? "brazil" : "brasil";
  location.replace("/" + locale + "/" + section + "/" + location.search);
} catch (error) {}
`;

export default function HomePage() {
  return (
    <main id="content" className="gate">
      <script dangerouslySetInnerHTML={{ __html: redirectScript }} />
      <h1>News, explained</h1>
      <p>Notícias explicadas</p>
      <p>Choose a language to read the current edition.</p>
      <p>
        <a href={sectionPath("pt-br", "brazil")}>Português</a>
        <a href={sectionPath("en", "brazil")}>English</a>
      </p>
    </main>
  );
}
