"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fill } from "@/lib/fill.js";
import { sectionPath, storyPath } from "@/lib/routes.js";
import {
  SUBTOPICS,
  TOPICS,
  filtersToQuery,
  isDefaultEdition,
  parseFilters,
  presentStories,
} from "@/lib/search.js";
import type { Dictionary, Locale } from "@/lib/dictionary";

type Filters = {
  q: string;
  topics: string[];
  subtopics: string[];
  countries: string[];
};

type StoryCard = {
  id: string;
  title: string;
  description: string;
  topics: string[];
  subtopics: string[];
  countries: string[];
  stage: string;
  sourcePublishedAt: string;
  sourcePublishedLabel: string;
  outlet: string;
  sourceUrl: string;
  featured: { until: string; rank: number } | null;
  status: string;
};

const emptyFilters: Filters = { q: "", topics: [], subtopics: [], countries: [] };

function toggle(current: string[], value: string, order: readonly string[]) {
  const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  return order.filter((item) => next.includes(item));
}

export function Feed({
  locale,
  section,
  stories,
  dict,
  builtAt,
}: {
  locale: Locale;
  section: "brazil" | "world";
  stories: StoryCard[];
  dict: Dictionary;
  builtAt: string;
}) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);

  function write(next: Filters) {
    const query = filtersToQuery(section === "world" ? next : { ...next, countries: [] });
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event("app-url"));
  }

  function update(next: Filters) {
    setFilters(next);
    write(next);
  }

  useEffect(() => {
    const read = () => parseFilters(new URLSearchParams(window.location.search)) as Filters;
    const apply = () => {
      const next = read();
      setFilters(next);
      if (section !== "world" && next.countries.length > 0) write(next);
    };
    apply();
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
  }, [section]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const filtered = !isDefaultEdition(section === "world" ? filters : { ...filters, countries: [] });
  const items = presentStories(stories, section, filters, builtAt);
  const countLabel = items.length === 1 ? dict.oneResult : fill(dict.results, { count: items.length });
  const countries = [...new Set(stories.flatMap((story) => story.countries))].sort((a, b) => {
    if (a === "INT") return 1;
    if (b === "INT") return -1;
    return a.localeCompare(b);
  });

  function hrefFor(target: "brazil" | "world") {
    const next = target === "world" ? filters : { ...filters, countries: [] };
    const query = filtersToQuery(next);
    return `${sectionPath(locale, target)}${query ? `?${query}` : ""}`;
  }

  function chip(label: string, onRemove: () => void) {
    return (
      <li key={label}>
        <button type="button" onClick={onRemove} aria-label={fill(dict.removeFilter, { label })}>
          {label}
        </button>
      </li>
    );
  }

  const chips = [
    filters.q.trim()
      ? chip(fill(dict.chipQuery, { label: filters.q.trim() }), () => update({ ...filters, q: "" }))
      : null,
    ...filters.topics.map((topic) =>
      chip(fill(dict.chipTopic, { label: dict.topics[topic as keyof typeof dict.topics] }), () =>
        update({ ...filters, topics: filters.topics.filter((item) => item !== topic) }),
      ),
    ),
    ...filters.subtopics.map((topic) =>
      chip(fill(dict.chipSubtopic, { label: dict.subtopics[topic as keyof typeof dict.subtopics] }), () =>
        update({ ...filters, subtopics: filters.subtopics.filter((item) => item !== topic) }),
      ),
    ),
    ...(section === "world"
      ? filters.countries.map((country) =>
          chip(
            fill(dict.chipCountry, {
              label: dict.countries[country as keyof typeof dict.countries] || country,
            }),
            () => update({ ...filters, countries: filters.countries.filter((item) => item !== country) }),
          ),
        )
      : []),
  ];

  return (
    <div className="edition">
      <h1 className="visually-hidden">{dict.sections[section]}</h1>
      <nav className="tabs" aria-label={dict.sections[section]}>
        {(["brazil", "world"] as const).map((item) => (
          <Link key={item} className="tab" href={hrefFor(item)} aria-current={item === section ? "page" : undefined}>
            {dict.sections[item]}
          </Link>
        ))}
      </nav>
      <form role="search" className="search" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="search">{dict.searchLabel}</label>
        <input
          id="search"
          type="search"
          value={filters.q}
          placeholder={dict.searchPlaceholder}
          onChange={(event) => {
            const next = { ...filters, q: event.target.value };
            setFilters(next);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => write(next), 200);
          }}
        />
      </form>
      <div className="topics">
        <p id="topics-label">{dict.topicsLabel}</p>
        <div role="group" aria-labelledby="topics-label">
          {TOPICS.map((topic) => {
            const pressed = filters.topics.includes(topic);
            return (
              <button
                key={topic}
                type="button"
                aria-pressed={pressed}
                onClick={() => update({ ...filters, topics: toggle(filters.topics, topic, TOPICS) })}
              >
                {dict.topics[topic as keyof typeof dict.topics]}
                {pressed ? <span className="visually-hidden"> {dict.selected}</span> : null}
              </button>
            );
          })}
        </div>
        <button
          ref={filterButtonRef}
          type="button"
          className="filter-open"
          aria-haspopup="dialog"
          onClick={() => {
            setDraft(filters);
            dialogRef.current?.showModal();
          }}
        >
          {dict.filter}
        </button>
      </div>
      {filtered ? (
        <div className="active-filters">
          <h2>{dict.activeFilters}</h2>
          <ul>
            {chips}
            <li>
              <button type="button" onClick={() => update(emptyFilters)}>
                {dict.clear}
              </button>
            </li>
          </ul>
        </div>
      ) : null}
      <p className="count" aria-live="polite">
        {countLabel}
      </p>
      {items.length === 0 ? (
        <p className="empty">
          {dict.noResults}{" "}
          <button type="button" onClick={() => update(emptyFilters)}>
            {dict.clear}
          </button>
        </p>
      ) : (
        <div className="story-list">
          {items.map((item, index) => {
            const story = item.story as StoryCard;
            const className = filtered ? "compact" : index === 0 ? "lead" : item.highlight ? "highlight" : "compact";
            return (
              <article key={story.id} className={className}>
                <p className="kicker">
                  {item.highlight ? <span className="mark">{dict.highlight}</span> : null}
                  {story.status === "sample" ? <span className="mark sample">{dict.sample}</span> : null}
                  <span>{story.topics.map((topic) => dict.topics[topic as keyof typeof dict.topics]).join(" · ")}</span>
                </p>
                <h2>
                  <Link href={storyPath(locale, story.id)}>{story.title}</Link>
                </h2>
                <p className="dek">{story.description}</p>
                <p className="meta">
                  <a href={story.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {fill(dict.readOn, { outlet: story.outlet })}
                    <span className="visually-hidden"> {dict.newTab}</span>
                  </a>
                  <time dateTime={story.sourcePublishedAt}>{story.sourcePublishedLabel}</time>
                </p>
                <p className="stage">
                  {dict.stageLabel}: {dict.stages[story.stage as keyof typeof dict.stages]}
                </p>
              </article>
            );
          })}
        </div>
      )}
      <dialog
        ref={dialogRef}
        className="filter-dialog"
        aria-labelledby="filter-title"
        onClose={() => filterButtonRef.current?.focus()}
      >
        <form
          method="dialog"
          onSubmit={(event) => {
            event.preventDefault();
            update({ ...filters, subtopics: draft.subtopics, countries: draft.countries });
            dialogRef.current?.close();
          }}
        >
          <h2 id="filter-title">{dict.filterTitle}</h2>
          {section === "world" ? (
            <fieldset>
              <legend>{dict.countriesLabel}</legend>
              {countries.map((country) => (
                <label key={country}>
                  <input
                    type="checkbox"
                    checked={draft.countries.includes(country)}
                    onChange={() =>
                      setDraft({ ...draft, countries: toggle(draft.countries, country, countries) })
                    }
                  />
                  {dict.countries[country as keyof typeof dict.countries] || country}
                </label>
              ))}
            </fieldset>
          ) : null}
          <fieldset>
            <legend>{dict.subtopicsLabel}</legend>
            {SUBTOPICS.map((topic) => (
              <label key={topic}>
                <input
                  type="checkbox"
                  checked={draft.subtopics.includes(topic)}
                  onChange={() => setDraft({ ...draft, subtopics: toggle(draft.subtopics, topic, SUBTOPICS) })}
                />
                {dict.subtopics[topic as keyof typeof dict.subtopics]}
              </label>
            ))}
          </fieldset>
          <div className="dialog-actions">
            <button type="button" onClick={() => dialogRef.current?.close()}>
              {dict.close}
            </button>
            <button type="submit">{dict.apply}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
