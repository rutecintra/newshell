"use client";

import { useEffect, useState } from "react";
import { isLocale, switchLocalePath } from "@/lib/routes.js";
import type { Dictionary, Locale } from "@/lib/dictionary";

const options: { id: Locale; labelKey: "portuguese" | "english" }[] = [
  { id: "pt-br", labelKey: "portuguese" },
  { id: "en", labelKey: "english" },
];

export function LanguageSwitch({
  locale,
  dict,
  path,
}: {
  locale: string;
  dict: Dictionary;
  path: string;
}) {
  const current = isLocale(locale) ? locale : "pt-br";
  const [hrefs, setHrefs] = useState<Record<Locale, string>>({
    "pt-br": switchLocalePath(path, "", "pt-br"),
    en: switchLocalePath(path, "", "en"),
  });

  useEffect(() => {
    const sync = () => {
      setHrefs({
        "pt-br": switchLocalePath(window.location.pathname, window.location.search, "pt-br"),
        en: switchLocalePath(window.location.pathname, window.location.search, "en"),
      });
    };
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("app-url", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("app-url", sync);
    };
  }, []);

  return (
    <nav className="languages" aria-label={dict.language}>
      {options.map((option) => (
        <a
          key={option.id}
          href={hrefs[option.id]}
          hrefLang={option.id === "en" ? "en" : "pt-BR"}
          aria-current={option.id === current ? "true" : undefined}
          onClick={() => localStorage.setItem("locale", option.id)}
        >
          {dict[option.labelKey]}
        </a>
      ))}
    </nav>
  );
}
