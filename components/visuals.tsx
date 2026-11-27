import type { Dictionary, Locale } from "@/lib/dictionary";

type Span = { type: string; text: string; href?: string };
type Source = { id: string; outlet: string; url: string; kind: string; language: string };
export type Visual = {
  id: string;
  type: string;
  sourceId: string;
  unit?: string;
  series?: { id: string; value: number }[];
  points?: { id: string; value: number }[];
  events?: { id: string; at: string; state: string }[];
  discussed?: string[];
  undefinedItems?: string[];
  today?: string[];
  proposal?: string[];
  locales: Record<string, VisualCopy>;
};
type VisualCopy = {
  title: string;
  caption: string;
  alt: string;
  period?: string;
  leftHeading?: string;
  rightHeading?: string;
  labels: Record<string, string>;
};

function formatWhen(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function Prose({ paragraphs }: { paragraphs: Span[][] }) {
  return paragraphs.map((paragraph, index) => (
    <p key={index}>
      {paragraph.map((span, spanIndex) => {
        if (span.type === "strong") return <strong key={spanIndex}>{span.text}</strong>;
        if (span.type === "link" && span.href) {
          return (
            <a key={spanIndex} href={span.href}>
              {span.text}
            </a>
          );
        }
        return span.text;
      })}
    </p>
  ));
}

function ValueTable({
  rows,
  unit,
  caption,
}: {
  rows: { label: string; value: number }[];
  unit?: string;
  caption: string;
}) {
  return (
    <table>
      <caption>{caption}</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>
              {row.value}
              {unit ? ` ${unit}` : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StoryVisual({
  visual,
  locale,
  dict,
  source,
}: {
  visual: Visual;
  locale: Locale;
  dict: Dictionary;
  source?: Source;
}) {
  const copy = visual.locales[locale];
  const rows = (visual.series || visual.points || []).map((row) => ({
    label: copy.labels[row.id],
    value: row.value,
  }));
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <figure className="visual" aria-label={copy.alt}>
      <figcaption>
        <strong>{copy.title}</strong>
        <p>{copy.caption}</p>
      </figcaption>
      {visual.type === "bars" ? (
        <div className="bars">
          {rows.map((row) => (
            <div className="bar-row" key={row.label}>
              <span>{row.label}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${(row.value / max) * 100}%` }} />
              </span>
              <span>
                {row.value}
                {visual.unit ? ` ${visual.unit}` : ""}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {visual.type === "line" ? <LineChart rows={rows} unit={visual.unit} /> : null}
      {visual.type === "timeline" ? (
        <ol className="timeline">
          {(visual.events || []).map((event) => (
            <li key={event.id} className={event.state === "expected" ? "expected" : "occurred"}>
              <p className="state">{event.state === "expected" ? dict.expected : dict.occurred}</p>
              <time dateTime={event.at}>{formatWhen(event.at, locale)}</time>
              <p>{copy.labels[event.id]}</p>
            </li>
          ))}
        </ol>
      ) : null}
      {visual.type === "discussion" || visual.type === "rule-change" ? (
        <div className="columns">
          <section>
            <h3>{copy.leftHeading}</h3>
            <ul>
              {(visual.type === "discussion" ? visual.discussed : visual.today)?.map((id) => (
                <li key={id}>{copy.labels[id]}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3>{copy.rightHeading}</h3>
            <ul>
              {(visual.type === "discussion" ? visual.undefinedItems : visual.proposal)?.map((id) => (
                <li key={id}>{copy.labels[id]}</li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
      <p className="visual-meta">
        {dict.visualSource}: {source?.outlet}
        {visual.unit ? ` · ${dict.visualUnit}: ${visual.unit}` : ""}
        {copy.period ? ` · ${dict.visualPeriod}: ${copy.period}` : ""}
      </p>
      {rows.length > 0 ? (
        <ValueTable rows={rows} unit={visual.unit} caption={`${dict.textAlternative}. ${copy.alt}`} />
      ) : (
        <p className="text-alt">
          <strong>{dict.textAlternative}. </strong>
          {copy.alt}
        </p>
      )}
    </figure>
  );
}

function LineChart({ rows, unit }: { rows: { label: string; value: number }[]; unit?: string }) {
  const width = 640;
  const height = 220;
  const pad = 28;
  const values = rows.map((row) => row.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = rows.map((row, index) => {
    const x = pad + (index * (width - pad * 2)) / Math.max(rows.length - 1, 1);
    const y = height - pad - ((row.value - min) / span) * (height - pad * 2);
    return { ...row, x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img">
      <polyline points={line} fill="none" stroke="#0c3d6e" strokeWidth="3" />
      {points.map((point) => (
        <g key={point.label}>
          <circle cx={point.x} cy={point.y} r="5" fill="#0c3d6e" />
          <text x={point.x} y={height - 8} textAnchor="middle" fill="#1c1915" fontSize="14">
            {point.label}
          </text>
          <text x={point.x} y={point.y - 10} textAnchor="middle" fill="#1c1915" fontSize="14">
            {point.value}
            {unit ? unit : ""}
          </text>
        </g>
      ))}
    </svg>
  );
}
