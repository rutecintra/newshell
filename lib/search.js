export const TOPICS = ["politics", "education", "social-rights"];
export const SUBTOPICS = ["women", "lgbtqia", "racial-equality", "disability"];
export const STAGES = ["under-discussion", "introduced", "approved", "in-force"];
export const SECTIONS = ["brazil", "world"];
export const LOCALES = ["pt-br", "en"];
export const STATUSES = ["sample", "draft", "published"];
export const SOURCE_KINDS = ["report", "document", "dataset"];
export const VISUAL_TYPES = ["bars", "line", "timeline", "rule-change", "discussion"];
export const PLACEMENTS = [
  "what-happened",
  "in-plain-terms",
  "who-may-be-affected",
  "where-things-stand",
];

export function fold(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function splitList(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseFilters(params) {
  return {
    q: params.get("q") ?? "",
    topics: splitList(params.get("topic")).filter((item) => TOPICS.includes(item)),
    subtopics: splitList(params.get("subtopic")).filter((item) => SUBTOPICS.includes(item)),
    countries: splitList(params.get("country"))
      .map((item) => item.toUpperCase())
      .filter((item) => item === "INT" || /^[A-Z]{2}$/.test(item)),
  };
}

export function isDefaultEdition(filters) {
  return (
    filters.q.trim() === "" &&
    filters.topics.length === 0 &&
    filters.subtopics.length === 0 &&
    filters.countries.length === 0
  );
}

export function storyMatches(story, filters) {
  const terms = fold(filters.q).split(/\s+/).filter(Boolean);
  if (terms.length > 0) {
    const haystack = fold(`${story.title} ${story.description}`);
    if (terms.some((term) => !haystack.includes(term))) return false;
  }
  if (filters.topics.length > 0 && !story.topics.some((topic) => filters.topics.includes(topic))) {
    return false;
  }
  if (
    filters.subtopics.length > 0 &&
    !story.subtopics.some((topic) => filters.subtopics.includes(topic))
  ) {
    return false;
  }
  if (
    filters.countries.length > 0 &&
    !story.countries.some((country) => filters.countries.includes(country))
  ) {
    return false;
  }
  return true;
}

export function filtersToQuery(filters) {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q) params.set("q", q);
  const topics = TOPICS.filter((topic) => filters.topics.includes(topic));
  if (topics.length > 0) params.set("topic", topics.join(","));
  const subtopics = SUBTOPICS.filter((topic) => filters.subtopics.includes(topic));
  if (subtopics.length > 0) params.set("subtopic", subtopics.join(","));
  const countries = [...new Set(filters.countries)].sort();
  if (countries.length > 0) params.set("country", countries.join(","));
  return params.toString();
}

export function presentStories(stories, section, filters, nowIso) {
  const filtersForSection =
    section === "world" ? filters : { ...filters, countries: [] };
  const matched = stories.filter((story) => storyMatches(story, filtersForSection));
  const byDate = [...matched].sort((a, b) =>
    b.sourcePublishedAt.localeCompare(a.sourcePublishedAt),
  );
  if (section !== "world" || !isDefaultEdition(filtersForSection)) {
    return byDate.map((story) => ({ story, highlight: false }));
  }
  const featured = byDate
    .filter((story) => story.featured && story.featured.until >= nowIso)
    .sort(
      (a, b) =>
        a.featured.rank - b.featured.rank ||
        b.sourcePublishedAt.localeCompare(a.sourcePublishedAt),
    )
    .slice(0, 3);
  const featuredIds = new Set(featured.map((story) => story.id));
  return [
    ...featured.map((story) => ({ story, highlight: true })),
    ...byDate
      .filter((story) => !featuredIds.has(story.id))
      .map((story) => ({ story, highlight: false })),
  ];
}
