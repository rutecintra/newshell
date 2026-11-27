#!/usr/bin/env python3
"""Collect headline metadata from public RSS and Atom feeds.

Full articles are not stored. A run writes queue files only when the metadata,
the feed validators, or the recorded errors change.
"""

import hashlib
import json
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit, urlunsplit, urlencode
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "config" / "sources.json"
QUEUE = ROOT / "queue"
PENDING = QUEUE / "pending.json"
STATE = QUEUE / "state.json"
HISTORY = QUEUE / "history.json"
USER_AGENT = "ExplainedNewsBot/0.1 (+https://github.com/rutecintra/newshell; metadata only)"
TRACKING = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
}
TAG = re.compile(r"<[^>]+>")
MAX_ITEMS = 400
MAX_SUMMARY = 280


def dump(data):
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def load_json(path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_url(url):
    parts = urlsplit((url or "").strip())
    scheme = (parts.scheme or "https").lower()
    host = parts.netloc.lower()
    path = parts.path or "/"
    if path != "/":
        path = path.rstrip("/")
    query = [
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if key.lower() not in TRACKING
    ]
    query.sort()
    return urlunsplit((scheme, host, path, urlencode(query), ""))


def item_id(url):
    return hashlib.sha256(normalize_url(url).encode("utf-8")).hexdigest()[:16]


def plain_text(value):
    text = unescape(value or "")
    text = TAG.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= MAX_SUMMARY:
        return text
    return text[: MAX_SUMMARY - 1].rstrip() + "…"


def local_name(tag):
    return tag.rsplit("}", 1)[-1]


def child_text(node, name):
    for child in list(node):
        if local_name(child.tag) == name:
            return "".join(child.itertext()).strip()
    return ""


def child_link(node):
    link = child_text(node, "link")
    if link:
        return link
    for child in list(node):
        if local_name(child.tag) == "link" and child.attrib.get("href"):
            rel = child.attrib.get("rel", "alternate")
            if rel == "alternate":
                return child.attrib["href"].strip()
    for child in list(node):
        if local_name(child.tag) == "link" and child.attrib.get("href"):
            return child.attrib["href"].strip()
    return ""


def parse_date(value):
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, IndexError):
        parsed = None
    if parsed is None:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_feed(xml_text):
    root = ElementTree.fromstring(xml_text)
    nodes = [node for node in root.iter() if local_name(node.tag) in ("item", "entry")]
    items = []
    for node in nodes:
        url = child_link(node) or child_text(node, "guid")
        title = plain_text(child_text(node, "title"))
        if not url or not title or not url.startswith("http"):
            continue
        published = parse_date(
            child_text(node, "pubDate")
            or child_text(node, "published")
            or child_text(node, "updated")
            or child_text(node, "date")
        )
        summary = plain_text(child_text(node, "description") or child_text(node, "summary"))
        items.append(
            {
                "url": normalize_url(url),
                "title": title,
                "summary": summary,
                "publishedAt": published,
            }
        )
    return items[:30]


def fetch(url, headers):
    last_error = None
    for attempt in range(3):
        request = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                body = response.read()
                return response.status, dict(response.headers), body
        except urllib.error.HTTPError as error:
            if error.code == 304:
                return 304, dict(error.headers), b""
            last_error = error
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
        except urllib.error.URLError as error:
            last_error = error
            if attempt == 2:
                raise
        time.sleep(1 + attempt)
    raise last_error


def collect_source(source, previous):
    headers = {"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"}
    if previous.get("etag"):
        headers["If-None-Match"] = previous["etag"]
    if previous.get("lastModified"):
        headers["If-Modified-Since"] = previous["lastModified"]
    status, response_headers, body = fetch(source["feedUrl"], headers)
    state = {
        "etag": response_headers.get("ETag") or response_headers.get("Etag") or previous.get("etag"),
        "lastModified": response_headers.get("Last-Modified") or previous.get("lastModified"),
        "lastError": None,
    }
    if status == 304:
        state["lastSuccessAt"] = previous.get("lastSuccessAt")
        return state, [], "not-modified"
    parsed = parse_feed(body.decode("utf-8", errors="replace"))
    collected_at = now_iso()
    items = []
    for entry in parsed:
        items.append(
            {
                "id": item_id(entry["url"]),
                "sourceId": source["id"],
                "outlet": source["outlet"],
                "title": entry["title"],
                "summary": entry["summary"],
                "url": entry["url"],
                "language": source["language"],
                "coverage": source["coverage"],
                "publishedAt": entry["publishedAt"],
                "collectedAt": collected_at,
            }
        )
    state["lastSuccessAt"] = collected_at
    return state, items, "ok"


def merge_pending(existing, found):
    by_id = {item["id"]: item for item in existing}
    for item in found:
        by_id[item["id"]] = item
    def sort_key(item):
        return item.get("publishedAt") or ""
    ordered = sorted(by_id.values(), key=sort_key, reverse=True)
    return ordered[:MAX_ITEMS]


def main():
    config = json.loads(SOURCES.read_text(encoding="utf-8"))
    pending = load_json(PENDING, [])
    state = load_json(STATE, {"feeds": {}})
    history = load_json(HISTORY, [])
    feeds = dict(state.get("feeds") or {})
    found = []
    run_feeds = []
    for source in config["sources"]:
        previous = feeds.get(source["id"]) or {}
        try:
            next_state, items, status = collect_source(source, previous)
            feeds[source["id"]] = next_state
            found.extend(items)
            run_feeds.append({"id": source["id"], "status": status, "items": len(items), "error": None})
            print(f"{source['id']}: {status} ({len(items)})")
        except Exception as error:
            message = str(error)
            feeds[source["id"]] = {
                "etag": previous.get("etag"),
                "lastModified": previous.get("lastModified"),
                "lastSuccessAt": previous.get("lastSuccessAt"),
                "lastError": message,
            }
            run_feeds.append({"id": source["id"], "status": "error", "items": 0, "error": message})
            print(f"{source['id']}: error: {message}")
    next_pending = merge_pending(pending, found) if found else pending
    next_state = {"feeds": feeds}
    changed = dump(next_pending) != dump(pending) or dump(next_state) != dump(state)
    if not changed:
        print("no metadata changes")
        return
    history = ([{"at": now_iso(), "feeds": run_feeds}] + history)[:100]
    QUEUE.mkdir(parents=True, exist_ok=True)
    PENDING.write_text(dump(next_pending), encoding="utf-8")
    STATE.write_text(dump(next_state), encoding="utf-8")
    HISTORY.write_text(dump(history), encoding="utf-8")
    print(f"wrote {len(next_pending)} queued items")


if __name__ == "__main__":
    main()
