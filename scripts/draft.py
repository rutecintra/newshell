#!/usr/bin/env python3
"""Draft bilingual explanations from the queue branch.

Trafilatura reads the article in memory. Groq writes the draft. The full
article is not stored. Stories are written with status draft, so the public
edition stays unchanged until a reviewer sets status to published.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import urllib.error
import urllib.request
from datetime import datetime, timezone
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


class GroqError(RuntimeError):
    def __init__(self, code, detail):
        super().__init__(f"Groq returned {code}: {detail}")
        self.code = code


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
    raw = text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)


def build_story(item, model, reviewed_at):
    if not isinstance(model, dict):
        return None
    topics = [topic for topic in model.get("topics") or [] if topic in TOPICS]
    if not topics:
        return None
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
    for locale in ("pt-br", "en"):
        copy = (model.get("locales") or {}).get(locale) or {}
        title = clean_line(copy.get("title"))
        description = clean_line(copy.get("description"))
        fields = {}
        for heading, field in FIELDS:
            snake = re.sub(r"(?<!^)(?=[A-Z])", "_", field).lower()
            fields[field] = prose(copy.get(field) or copy.get(snake))
        count = word_count(fields)
        if not title or sentence_count(description) < 2 or count < MIN_WORDS:
            print(f"reject {item['id']} {locale}: {count} words, description={description[:120]!r}")
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
        "status": "draft",
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


def draft_items(pending, known_urls, known_ids, extract, ask, limit, reviewed_at, max_attempts=6):
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
        try:
            model = ask(item, article)
        except GroqError as error:
            print(f"skip {item['id']}: {error}")
            if error.code in (400, 401, 403, 404) or error.code == 200:
                raise
            continue
        except Exception as error:
            print(f"skip {item['id']}: {error}")
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


def ask_groq(api_key, model_name, item, article):
    prompt = {
        "title": item.get("title"),
        "outlet": item.get("outlet"),
        "url": item.get("url"),
        "publishedAt": item.get("publishedAt"),
        "summary": item.get("summary"),
        "article": article[:12000],
    }
    instructions = (
        "Write a bilingual news explanation from the article. Return one JSON object only. "
        "Use only facts present in the article. Do not invent numbers, dates, names, or effects. "
        "If the decision stage is unclear, use under-discussion and say what is unknown. "
        "topics must be chosen from politics, education, social-rights. "
        "subtopics may be empty or chosen from women, lgbtqia, racial-equality, disability. "
        "countries are ISO codes or INT. stage is under-discussion, introduced, approved, or in-force. "
        "Each locale description is exactly two sentences. "
        "Together the four sections in each language run from 150 to 300 words. "
        "Explain an acronym the first time it appears. Do not paste long quotations. "
        "Keys: topics, subtopics, countries, stage, locales.pt-br and locales.en. "
        "Each locale has title, description, whatHappened, inPlainTerms, whoMayBeAffected, whereThingsStand."
    )
    body = {
        "model": model_name,
        "temperature": 0.2,
        "max_completion_tokens": 8000,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": instructions},
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
        ],
    }
    request = urllib.request.Request(
        GROQ_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise GroqError(error.code, detail) from error
    message = payload["choices"][0]["message"]
    content = message.get("content")
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    if not content:
        visible = {key: message.get(key) for key in message if key != "reasoning"}
        raise GroqError(200, "empty content " + json.dumps(visible, ensure_ascii=False)[:500])
    return parse_model_json(content)


def known_source_urls(stories_root):
    urls = set()
    ids = set()
    if not stories_root.exists():
        return urls, ids
    for folder in stories_root.iterdir():
        if not folder.is_dir():
            continue
        ids.add(folder.name)
        meta_path = folder / "meta.json"
        if not meta_path.exists():
            continue
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        for source in meta.get("sources") or []:
            if source.get("url"):
                urls.add(source["url"])
    return urls, ids


def remote_draft_urls():
    urls = set()
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
            for source in meta.get("sources") or []:
                if source.get("url"):
                    urls.add(source["url"])
    return urls


def load_queue():
    fetched = subprocess.run(
        ["git", "fetch", "origin", "queue:refs/remotes/origin/queue"],
        capture_output=True,
        text=True,
        check=False,
    )
    if fetched.returncode != 0:
        detail = (fetched.stderr or fetched.stdout).strip()
        raise SystemExit(f"Could not fetch the queue branch. {detail}")
    shown = subprocess.run(
        ["git", "show", "origin/queue:queue/pending.json"],
        capture_output=True,
        text=True,
        check=False,
    )
    if shown.returncode != 0:
        detail = (shown.stderr or "").strip()
        raise SystemExit(f"The queue branch has no queue/pending.json. {detail}")
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
        raise SystemExit("Set GROQ_API_KEY to draft explanations. The free Groq plan is enough to start.")
    model_name = os.environ.get("GROQ_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    limit = int(os.environ.get("DRAFT_LIMIT", "2"))
    pending = load_queue()
    urls, ids = known_source_urls(STORIES)
    urls.update(remote_draft_urls())
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
            raise SystemExit("No draft was written. See the skip lines above.")
        print("no drafts")


if __name__ == "__main__":
    main()
