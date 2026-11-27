import { sectionPath } from "@/lib/routes.js";
import type { Dictionary, Locale } from "@/lib/dictionary";
import { LanguageSwitch } from "@/components/language-switch";

export function SiteHeader({
  locale,
  dict,
  path,
}: {
  locale: Locale;
  dict: Dictionary;
  path: string;
}) {
  return (
    <header className="site-header">
      <a className="skip" href="#content">
        {dict.skip}
      </a>
      <div className="brand-row">
        <a className="brand" href={sectionPath(locale, "brazil")}>
          {dict.siteName}
        </a>
        <LanguageSwitch locale={locale} dict={dict} path={path} />
      </div>
    </header>
  );
}
