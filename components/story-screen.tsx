import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { StoryArticle } from "@/components/story-article";
import { loadStories } from "@/lib/content.js";
import { loadDictionary } from "@/lib/i18n.js";
import { isLocale, sectionPath, storyPath } from "@/lib/routes.js";
import type { Locale } from "@/lib/dictionary";

export function storyStaticParams(locale: "pt-br" | "en") {
  return loadStories().map((story) => ({ locale, id: story.id }));
}

export async function storyMetadata(locale: string, id: string): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const story = loadStories().find((item) => item.id === id);
  if (!story) return {};
  const dict = loadDictionary(locale);
  const copy = story.locales[locale];
  const title = `${copy.title} · ${dict.siteName}`;
  return {
    title,
    description: copy.description,
    alternates: {
      canonical: storyPath(locale, id),
      languages: {
        "pt-BR": storyPath("pt-br", id),
        en: storyPath("en", id),
      },
    },
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: storyPath(locale, id),
      type: "article",
      locale: locale === "en" ? "en_US" : "pt_BR",
    },
    robots: story.status === "published" ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export async function StoryScreen({ locale, id }: { locale: string; id: string }) {
  if (!isLocale(locale)) notFound();
  const story = loadStories().find((item) => item.id === id);
  if (!story) notFound();
  const dict = loadDictionary(locale);
  const home = story.sections.includes("brazil") ? "brazil" : "world";

  return (
    <>
      <SiteHeader locale={locale as Locale} dict={dict} path={storyPath(locale, id)} />
      <main id="content">
        <p className="back">
          <a href={sectionPath(locale, home)}>{dict.sections[home]}</a>
        </p>
        <StoryArticle story={story} locale={locale as Locale} dict={dict} />
      </main>
    </>
  );
}
