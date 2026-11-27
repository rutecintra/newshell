import type { Metadata } from "next";
import { sectionPath } from "@/lib/routes.js";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Notícias explicadas",
};

const redirectScript = `
try {
  location.replace("/pt-br/brasil/" + location.search);
} catch (error) {}
`;

export default function HomePage() {
  return (
    <main id="content" className="gate">
      <script dangerouslySetInnerHTML={{ __html: redirectScript }} />
      <h1>Notícias explicadas</h1>
      <p>
        <a href={sectionPath("pt-br", "brazil")}>Brasil</a>
      </p>
    </main>
  );
}
