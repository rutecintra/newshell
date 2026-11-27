#!/usr/bin/env python3
"""Draft Portuguese explanations from the queue branch.

Trafilatura reads the article in memory. Groq writes the draft. The full
article is not stored. Stories are written with status published. Merging the pull request
is the review, and that merge is what reaches the public edition.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STORIES = ROOT / "content" / "stories"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-oss-20b"
MIN_ARTICLE_CHARS = 400
MIN_WORDS = 80
TOPICS = ("politics", "education", "social-rights")
SUBTOPICS = ("women", "lgbtqia", "racial-equality", "disability")
STAGES = ("under-discussion", "introduced", "approved", "in-force")
SECTIONS = ("brazil", "world")
FIELDS = (
    ("what-happened", "whatHappened"),
    ("in-plain-terms", "inPlainTerms"),
    ("who-may-be-affected", "whoMayBeAffected"),
    ("where-things-stand", "whereThingsStand"),
)
TAG = re.compile(r"<[^>]+>")
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
RESET = re.compile(r"([0-9]*\.?[0-9]+)(ms|s|m|h)")
SAO_PAULO = timezone(timedelta(hours=-3))
DAILY_CAP = 30
# One call keeps max_tokens plus the article under the free 8,000 tokens per minute.
MINUTE_BUDGET = 6000
LAST_LIMIT = {}


class GroqError(RuntimeError):
    def __init__(self, code, detail):
        super().__init__(f"Groq returned {code}: {detail}")
        self.code = code
        text = str(detail).lower()
        self.daily = code == 429 and ("per day" in text or "tokens per day" in text or "tpd" in text)


def report(message):
    text = " ".join(str(message).split())
    print(text)
    print(f"::error::{text[:1000]}")


def story_id(queue_id):
    return "q-" + queue_id


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def word_count(locale_copy):
    text = " ".join(locale_copy[field] for _, field in FIELDS)
    return len([word for word in text.split() if word])


def sentence_count(value):
    return len(re.findall(r"[.!?](?:\s|$)", value))


def clean_line(value):
    return re.sub(r"\s+", " ", TAG.sub(" ", str(value or ""))).strip()


def prose(value):
    text = TAG.sub("", str(value or ""))
    parts = [re.sub(r"\s+", " ", part).strip() for part in re.split(r"\n\s*\n", text)]
    return "\n\n".join(part for part in parts if part)


def select_items(pending, known_urls, known_ids, limit):
    chosen = []
    for item in pending:
        url = item.get("url") or ""
        queue_id = item.get("id") or ""
        if not url.startswith("https://") or not queue_id or not item.get("title"):
            continue
        if not ISO.match(item.get("publishedAt") or ""):
            continue
        if url in known_urls or queue_id in known_ids or story_id(queue_id) in known_ids:
            continue
        chosen.append(item)
        if len(chosen) >= limit:
            break
    return chosen


def parse_model_json(text):
    raw = str(text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            return json.loads(raw[start : end + 1])
        raise


def locale_block(model, locale):
    locales = model.get("locales") if isinstance(model.get("locales"), dict) else model
    if not isinstance(locales, dict):
        return {}
    names = ("pt-br", "pt_br", "pt-BR", "pt", "portuguese")
    for name in names:
        block = locales.get(name)
        if isinstance(block, dict):
            flat = dict(block)
            for key in ("sections", "explanation", "content", "body"):
                nested = block.get(key)
                if isinstance(nested, dict):
                    flat.update(nested)
            return flat
    return {}


def long_strings(value, found=None):
    if found is None:
        found = []
    if isinstance(value, str) and len(value.split()) >= 20:
        found.append(value.strip())
    elif isinstance(value, dict):
        for item in value.values():
            long_strings(item, found)
    elif isinstance(value, list):
        for item in value:
            long_strings(item, found)
    return found


def field_text(block, field):
    snake = re.sub(r"(?<!^)(?=[A-Z])", "_", field).lower()
    kebab = snake.replace("_", "-")
    for key in (field, snake, kebab):
        if block.get(key):
            return block.get(key)
    return ""


def build_story(item, model, reviewed_at):
    if not isinstance(model, dict):
        return None
    raw_topics = model.get("topics") or []
    if isinstance(raw_topics, str):
        raw_topics = [part.strip() for part in raw_topics.split(",")]
    topics = [topic for topic in raw_topics if topic in TOPICS]
    if not topics:
        topics = ["politics"]
    subtopics = [topic for topic in model.get("subtopics") or [] if topic in SUBTOPICS]
    countries = []
    for country in model.get("countries") or []:
        code = str(country).upper()
        if code == "INT" or re.fullmatch(r"[A-Z]{2}", code):
            if code not in countries:
                countries.append(code)
    if not countries:
        countries = ["BR"] if "brazil" in (item.get("coverage") or []) else ["INT"]
    stage = model.get("stage") if model.get("stage") in STAGES else "under-discussion"
    sections = [section for section in item.get("coverage") or [] if section in SECTIONS]
    if not sections:
        return None
    locales = {}
    markdown = {}
    recovered = prose("\n\n".join(long_strings(model)))
    for locale in ("pt-br",):
        copy = locale_block(model, locale)
        title = clean_line(copy.get("title") or item.get("title"))
        description = clean_line(copy.get("description") or item.get("summary"))
        fields = {field: prose(field_text(copy, field)) for _, field in FIELDS}
        count = word_count(fields)
        if count < MIN_WORDS and len(recovered.split()) >= MIN_WORDS:
            fields = {
                "whatHappened": recovered,
                "inPlainTerms": "O mecanismo é o que o relato acima descreve.",
                "whoMayBeAffected": "As pessoas afetadas são as que o relato acima nomeia.",
                "whereThingsStand": "O estágio é só o que o relato acima afirma.",
            }
            count = word_count(fields)
        if description and sentence_count(description) < 2:
            description = description.rstrip(".") + ". A reportagem original está ligada nesta matéria."
        if not title or sentence_count(description) < 2 or count < MIN_WORDS:
            keys = ",".join(copy.keys()) if copy else "missing"
            top = ",".join(model.keys())
            report(f"reject {item['id']} {locale}: {count} words, keys={keys}, model={top}")
            return None
        if any(not fields[field] for _, field in FIELDS):
            print(f"reject {item['id']} {locale}: a section is empty")
            return None
        locales[locale] = {
            "title": title,
            "description": description,
            "reviewedAt": reviewed_at,
        }
        markdown[locale] = "\n".join(
            f"## {heading}\n\n{fields[field]}\n" for heading, field in FIELDS
        )
    meta = {
        "id": story_id(item["id"]),
        "status": "published",
        "sections": sections,
        "countries": countries,
        "topics": topics,
        "subtopics": subtopics,
        "stage": stage,
        "publishedAt": item["publishedAt"],
        "updatedAt": reviewed_at,
        "eventAt": None,
        "dateBasis": "source-publication",
        "featured": None,
        "sources": [
            {
                "id": "report",
                "outlet": item.get("outlet") or "Source",
                "url": item["url"],
                "language": item.get("language") or "pt-br",
                "kind": "report",
                "publishedAt": item["publishedAt"],
            }
        ],
        "visuals": [],
        "corrections": [],
        "locales": locales,
    }
    return {"id": meta["id"], "meta": meta, "markdown": markdown}


def draft_items(pending, known_urls, known_ids, extract, ask, limit, reviewed_at, max_attempts=None):
    if max_attempts is None:
        max_attempts = limit + 10
    written = []
    attempts = 0
    candidates = select_items(pending, known_urls, known_ids, max(len(pending), 1))
    for item in candidates:
        if len(written) >= limit or attempts >= max_attempts:
            break
        article = extract(item["url"]) or ""
        if len(article) < MIN_ARTICLE_CHARS:
            print(f"skip {item['id']}: article text is too short ({len(article)} chars)")
            continue
        attempts += 1
        model = None
        failed = False
        for retry in range(5):
            try:
                model = ask(item, article)
                break
            except GroqError as error:
                if error.code in (401, 403):
                    report(error)
                    raise
                if error.daily:
                    print(f"daily groq limit reached, kept {len(written)} stories")
                    return written
                if error.code == 429 and retry < 4:
                    print(f"rate limit on {item['id']}, retry {retry + 1}")
                    continue
                if error.code == 429:
                    print(f"minute limit still blocked, kept {len(written)} stories")
                    return written
                report(f"skip {item['id']}: {error}")
                failed = True
                break
            except Exception as error:
                report(f"skip {item['id']}: {error}")
                failed = True
                break
        if failed or model is None:
            continue
        built = build_story(item, model, reviewed_at)
        if not built:
            print(f"skip {item['id']}: draft did not meet the explanation rules")
            continue
        written.append(built)
        known_urls.add(item["url"])
        known_ids.add(item["id"])
    return written


def extract_article(url):
    import trafilatura

    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        return ""
    return trafilatura.extract(
        downloaded,
        include_comments=False,
        include_tables=False,
        favor_precision=True,
    ) or ""


def retry_delay(error):
    match = re.search(r"try again in ([0-9.]+)s", str(error))
    if not match:
        return 15
    return min(float(match.group(1)) + 1, 90)


def parse_reset_seconds(value):
    total = 0.0
    found = False
    for amount, unit in RESET.findall(str(value or "")):
        found = True
        number = float(amount)
        total += {"ms": number / 1000, "s": number, "m": number * 60, "h": number * 3600}[unit]
    if found:
        return total
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def limit_headers(headers):
    found = {}
    if not headers or not hasattr(headers, "get"):
        return found
    for name in ("x-ratelimit-remaining-tokens", "x-ratelimit-reset-tokens"):
        value = headers.get(name)
        if value:
            found[name] = str(value)
    return found


def minute_wait_seconds(headers, needed=MINUTE_BUDGET):
    if not headers:
        return 0
    raw = headers.get("x-ratelimit-remaining-tokens")
    if raw in (None, ""):
        return 60
    try:
        remaining = int(float(raw))
    except ValueError:
        return 60
    if remaining >= needed:
        return 0
    reset = parse_reset_seconds(headers.get("x-ratelimit-reset-tokens"))
    if reset is None:
        return 60
    return min(max(reset, 1), 90)


def wait_for_minute(headers):
    delay = minute_wait_seconds(headers)
    if delay:
        print(f"waiting {delay:.0f}s for the groq minute limit")
        time.sleep(delay)


def remember_limit(headers):
    LAST_LIMIT.clear()
    LAST_LIMIT.update(headers or {})


def reviewed_day(meta):
    locales = meta.get("locales") or {}
    block = locales.get("pt-br") if isinstance(locales.get("pt-br"), dict) else {}
    stamp = (block or {}).get("reviewedAt") or meta.get("updatedAt") or ""
    if not ISO.match(stamp):
        return ""
    moment = datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    return moment.astimezone(SAO_PAULO).date().isoformat()


def stories_on_day(metas, day):
    return sum(1 for meta in metas if reviewed_day(meta) == day)


def ask_groq(api_key, model_name, item, article):
    prompt = {
        "title": item.get("title"),
        "outlet": item.get("outlet"),
        "url": item.get("url"),
        "publishedAt": item.get("publishedAt"),
        "summary": item.get("summary"),
        "article": article[:3500],
    }
    instructions = (
        "Write a news explanation in Portuguese (pt-BR) from the article. Return one JSON object only. "
        "Use only facts present in the article. Do not invent numbers, dates, names, or effects. "
        "If the decision stage is unclear, use under-discussion and say what is unknown. "
        "topics must be chosen from politics, education, social-rights. "
        "subtopics may be empty or chosen from women, lgbtqia, racial-equality, disability. "
        "countries are ISO codes or INT. stage is under-discussion, introduced, approved, or in-force. "
        "The description is exactly two sentences. "
        "Together the four sections run from 150 to 300 words. "
        "Explain an acronym the first time it appears. Do not paste long quotations. "
        "Write every string in Portuguese. "
        "Keys: topics, subtopics, countries, stage, locales.pt-br. "
        "locales.pt-br has title, description, whatHappened, inPlainTerms, whoMayBeAffected, whereThingsStand."
    )
    body = {
        "model": model_name,
        "temperature": 0.2,
        "max_tokens": 2000,
        "reasoning_effort": "low",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": instructions},
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
        ],
    }
    wait_for_minute(LAST_LIMIT)
    request = urllib.request.Request(
        GROQ_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json",
            "User-Agent": "groq-python/0.32.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            found = limit_headers(response.headers)
            if "x-ratelimit-remaining-tokens" not in found:
                found["x-ratelimit-remaining-tokens"] = "0"
                found["x-ratelimit-reset-tokens"] = "60s"
            remember_limit(found)
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        found = limit_headers(error.headers)
        if error.code == 429 and "x-ratelimit-reset-tokens" not in found:
            found["x-ratelimit-remaining-tokens"] = "0"
            found["x-ratelimit-reset-tokens"] = f"{retry_delay(detail)}s"
        remember_limit(found)
        raise GroqError(error.code, detail) from error
    message = payload["choices"][0]["message"]
    content = message.get("content")
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    if not content:
        visible = {key: message.get(key) for key in message if key != "reasoning"}
        detail = "empty content " + json.dumps(visible, ensure_ascii=False)[:500]
        report(detail)
        raise GroqError(200, detail)
    return parse_model_json(content)


def known_source_urls(stories_root):
    urls = set()
    ids = set()
    metas = []
    if not stories_root.exists():
        return urls, ids, metas
    for folder in stories_root.iterdir():
        if not folder.is_dir():
            continue
        ids.add(folder.name)
        meta_path = folder / "meta.json"
        if not meta_path.exists():
            continue
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        metas.append(meta)
        for source in meta.get("sources") or []:
            if source.get("url"):
                urls.add(source["url"])
    return urls, ids, metas


def remote_draft_metas():
    metas = []
    listed = subprocess.run(
        ["git", "ls-remote", "--heads", "origin", "draft/*"],
        capture_output=True,
        text=True,
        check=False,
    )
    for line in listed.stdout.splitlines():
        parts = line.split()
        if len(parts) != 2 or "/draft/" not in parts[1]:
            continue
        branch = parts[1].split("refs/heads/", 1)[1]
        subprocess.run(["git", "fetch", "--depth", "1", "origin", branch], check=False)
        tree = subprocess.run(
            ["git", "ls-tree", "-r", "--name-only", f"origin/{branch}", "content/stories"],
            capture_output=True,
            text=True,
            check=False,
        )
        for path in tree.stdout.splitlines():
            if not path.endswith("/meta.json"):
                continue
            shown = subprocess.run(
                ["git", "show", f"origin/{branch}:{path}"],
                capture_output=True,
                text=True,
                check=False,
            )
            if shown.returncode != 0:
                continue
            try:
                meta = json.loads(shown.stdout)
            except json.JSONDecodeError:
                continue
            metas.append(meta)
    return metas


def load_queue():
    fetched = subprocess.run(
        ["git", "fetch", "origin", "queue:refs/remotes/origin/queue"],
        capture_output=True,
        text=True,
        check=False,
    )
    if fetched.returncode != 0:
        detail = (fetched.stderr or fetched.stdout).strip()
        report(f"Could not fetch the queue branch. {detail}")
        raise SystemExit(1)
    shown = subprocess.run(
        ["git", "show", "origin/queue:queue/pending.json"],
        capture_output=True,
        text=True,
        check=False,
    )
    if shown.returncode != 0:
        detail = (shown.stderr or "").strip()
        report(f"The queue branch has no queue/pending.json. {detail}")
        raise SystemExit(1)
    return json.loads(shown.stdout)


def write_story(stories_root, built):
    folder = stories_root / built["id"]
    folder.mkdir(parents=True, exist_ok=False)
    (folder / "meta.json").write_text(
        json.dumps(built["meta"], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    for locale, text in built["markdown"].items():
        (folder / f"{locale}.md").write_text(text, encoding="utf-8")


def main():
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        report("Set GROQ_API_KEY to draft explanations. The free Groq plan is enough to start.")
        raise SystemExit(1)
    model_name = os.environ.get("GROQ_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    requested = int(os.environ.get("DRAFT_LIMIT", str(DAILY_CAP)))
    pending = load_queue()
    urls, ids, local_metas = known_source_urls(STORIES)
    remote_metas = remote_draft_metas()
    for meta in remote_metas:
        for source in meta.get("sources") or []:
            if source.get("url"):
                urls.add(source["url"])
    day = datetime.now(SAO_PAULO).date().isoformat()
    already = stories_on_day(local_metas + remote_metas, day)
    room = max(0, DAILY_CAP - already)
    print(f"{already} stories already drafted on {day}, room for {room}")
    if room == 0:
        print("daily cap reached")
        return
    limit = min(requested, room)
    print(f"drafting up to {limit}")
    reviewed_at = now_iso()

    def ask(item, article):
        return ask_groq(api_key, model_name, item, article)

    print(f"queue has {len(pending)} headlines")
    eligible = select_items(pending, urls, ids, max(len(pending), 1))
    print(f"{len(eligible)} headlines are not drafted yet")
    written = draft_items(pending, urls, ids, extract_article, ask, limit, reviewed_at)
    for built in written:
        write_story(STORIES, built)
        print(f"wrote {built['id']}")
    if not written:
        if eligible:
            report("No draft was written. See the skip lines above.")
            raise SystemExit(1)
        print("no drafts")


if __name__ == "__main__":
    main()
