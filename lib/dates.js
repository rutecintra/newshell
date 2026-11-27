const TIME_ZONE = "America/Sao_Paulo";

export function formatAbsolute(iso, locale) {
  const loc = locale === "en" ? "en-GB" : "pt-BR";
  return new Intl.DateTimeFormat(loc, {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
