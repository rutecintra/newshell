import { fill } from "@/lib/fill.js";
import { formatAbsolute } from "@/lib/dates.js";
import { storyPath } from "@/lib/routes.js";
import { getSiteUrl } from "@/lib/site.js";
import type { Dictionary, Locale } from "@/lib/dictionary";
import { Prose, StoryVisual, type Visual } from "@/components/visuals";
import { ShareBar } from "@/components/share-bar";

const sections = [
  ["what-happened", "whatHappened"],
  ["in-plain-terms", "inPlainTerms"],
  ["who-may-be-affected", "whoMayBeAffected"],
  ["where-things-stand", "whereThingsStand"],
] as const;

type Story = {
  id: string;
  status: string;
  stage: string;
  topics: string[];
  subtopics: string[];
  countries: string[];
  updatedAt: string;
  sources: {
    id: string;
    outlet: string;
    url: string;
    kind: string;
    language: string;
    publishedAt: string;
  }[];
  visuals: (Visual & { after: string })[];
  corrections: { at: string; summary: Record<string, string> }[];
  locales: Record<
    string,
    {
      title: string;
      description: string;
      blocks: Record<string, { type: string; text: string; href?: string }[][]>;
    }
  >;
};

export function StoryArticle({
  story,
  locale,
  dict,
}: {
  story: Story;
  locale: Locale;
  dict: Dictionary;
}) {
  const copy = story.locales[locale];
  const report = story.sources.find((source) => source.kind === "report") ?? story.sources[0];
  const language = dict.languages[report.language as keyof typeof dict.languages] || report.language;
  const url = `${getSiteUrl()}${storyPath(locale, story.id)}`;

  return (
    <article className="story">
      {story.status === "sample" ? <p className="banner">{dict.sampleNotice}</p> : null}
      <p className="kicker">
        {story.status === "sample" ? <span className="mark sample">{dict.sample}</span> : null}
        <span>{story.topics.map((topic) => dict.topics[topic as keyof typeof dict.topics]).join(" · ")}</span>
      </p>
      <h1>{copy.title}</h1>
      <p className="dek">{copy.description}</p>
      <p className="stage">
        {dict.stageLabel}: {dict.stages[story.stage as keyof typeof dict.stages]}
      </p>
      <p className="meta">
        <a href={report.url} target="_blank" rel="noopener noreferrer">
          {fill(dict.readOn, { outlet: report.outlet })}
          <span className="visually-hidden"> {dict.newTab}</span>
        </a>
        <time dateTime={report.publishedAt}>
          {dict.sourcePublished}: {formatAbsolute(report.publishedAt, locale)}
        </time>
      </p>
      <p className="note">{fill(dict.reportLanguage, { language })}</p>
      {sections.map(([key, label]) => (
        <section key={key}>
          <h2>{dict[label]}</h2>
          <Prose paragraphs={copy.blocks[key] || []} />
          {story.visuals
            .filter((visual) => visual.after === key)
            .map((visual) => (
              <StoryVisual
                key={visual.id}
                visual={visual}
                locale={locale}
                dict={dict}
                source={story.sources.find((source) => source.id === visual.sourceId)}
              />
            ))}
        </section>
      ))}
      {story.corrections.length > 0 ? (
        <section>
          <h2>{dict.corrections}</h2>
          <ul>
            {story.corrections.map((correction) => (
              <li key={correction.at}>
                <time dateTime={correction.at}>{formatAbsolute(correction.at, locale)}</time>{" "}
                {correction.summary[locale]}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h2>{dict.sourcesHeading}</h2>
        <ul className="source-list">
          {story.sources.map((source) => (
            <li key={source.id}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.kind === "document"
                  ? dict.primaryDocument
                  : source.kind === "dataset"
                    ? dict.dataset
                    : fill(dict.readOn, { outlet: source.outlet })}
                <span className="visually-hidden"> {dict.newTab}</span>
              </a>
              <span>{source.outlet}</span>
            </li>
          ))}
        </ul>
        <ShareBar title={copy.title} url={url} dict={dict} />
        <p className="note">{fill(dict.explanationUpdated, { date: formatAbsolute(story.updatedAt, locale) })}</p>
      </section>
    </article>
  );
}
