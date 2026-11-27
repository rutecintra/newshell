import { sectionPath } from "@/lib/routes.js";
import type { Dictionary, Locale } from "@/lib/dictionary";

export function SiteHeader({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <header className="site-header">
      <a className="skip" href="#content">
        {dict.skip}
      </a>
      <div className="brand-row">
        <a className="brand" href={sectionPath(locale, "brazil")}>
          {dict.siteName}
        </a>
      </div>
    </header>
  );
}
