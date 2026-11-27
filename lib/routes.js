const SECTION_SLUG = {
  "pt-br": { brazil: "brasil", world: "mundo" },
  en: { brazil: "brazil", world: "world" },
};

const SLUG_SECTION = {
  "pt-br": { brasil: "brazil", mundo: "world" },
  en: { brazil: "brazil", world: "world" },
};

const STORY_SLUG = { "pt-br": "noticia", en: "story" };

export function isLocale(value) {
  return value === "pt-br" || value === "en";
}

export function sectionSlug(locale, section) {
  return SECTION_SLUG[locale][section];
}

export function sectionFromSlug(locale, slug) {
  return SLUG_SECTION[locale]?.[slug] ?? null;
}

export function storySlug(locale) {
  return STORY_SLUG[locale];
}

export function sectionPath(locale, section) {
  return `/${locale}/${sectionSlug(locale, section)}/`;
}

export function storyPath(locale, id) {
  return `/${locale}/${storySlug(locale)}/${id}/`;
}

export function switchLocalePath(pathname, search, target) {
  const localeTarget = isLocale(target) ? target : "pt-br";
  const query = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  const parts = pathname.split("/").filter(Boolean);
  const locale = parts[0];
  if (!isLocale(locale)) return sectionPath(localeTarget, "brazil") + query;
  if (parts.length >= 2) {
    const section = sectionFromSlug(locale, parts[1]);
    if (section) return sectionPath(localeTarget, section) + query;
    if (parts[1] === storySlug(locale) && parts[2]) {
      return storyPath(localeTarget, parts[2]) + query;
    }
  }
  return sectionPath(localeTarget, "brazil") + query;
}
