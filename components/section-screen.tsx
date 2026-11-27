import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Feed } from "@/components/feed";
import { loadStories, toIndexEntry } from "@/lib/content.js";
import { formatAbsolute } from "@/lib/dates.js";
import { fill } from "@/lib/fill.js";
import { loadDictionary } from "@/lib/i18n.js";
import { isLocale, sectionPath } from "@/lib/routes.js";
import type { Locale } from "@/lib/dictionary";

type Section = "brazil" | "world";

export async function sectionMetadata(locale: string, section: Section): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const dict = loadDictionary(locale);
  const title = `${dict.sections[section]} · ${dict.siteName}`;
  const stories = loadStories();
  return {
    title,
    description: dict.siteDescription,
    alternates: {
      canonical: sectionPath(locale, section),
      languages: {
        "pt-BR": sectionPath("pt-br", section),
        en: sectionPath("en", section),
      },
    },
    openGraph: {
      title,
      description: dict.siteDescription,
      url: sectionPath(locale, section),
      locale: locale === "en" ? "en_US" : "pt_BR",
    },
    robots: stories.some((story) => story.status === "published")
      ? { index: true, follow: true }
      : { index: false, follow: false },
  };
}

export async function SectionScreen({ locale, section }: { locale: string; section: Section }) {
  if (!isLocale(locale)) notFound();
  const dict = loadDictionary(locale);
  const cards = loadStories()
    .filter((story) => story.sections.includes(section))
    .map((story) => {
      const entry = toIndexEntry(story, locale);
      return {
        ...entry,
        sourcePublishedLabel: formatAbsolute(entry.sourcePublishedAt, locale),
      };
    });
  const latest = cards.map((card) => card.updatedAt).sort().at(-1);
  const sample = cards.some((card) => card.status === "sample");

  return (
    <>
      <SiteHeader locale={locale as Locale} dict={dict} path={sectionPath(locale, section)} />
      <main id="content">
        <Feed
          locale={locale as Locale}
          section={section}
          stories={cards}
          dict={dict}
          builtAt={new Date().toISOString()}
        />
      </main>
      <footer className="site-footer">
        <p>{dict.orderedBy}</p>
        {latest ? <p>{fill(dict.editionUpdated, { date: formatAbsolute(latest, locale) })}</p> : null}
        {sample ? <p>{dict.sampleEdition}</p> : null}
      </footer>
    </>
  );
}
