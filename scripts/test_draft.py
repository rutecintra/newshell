import unittest

from draft import (
    GroqError,
    build_story,
    draft_items,
    minute_wait_seconds,
    reviewed_day,
    select_items,
    stories_on_day,
    story_id,
)


def words(count):
    return " ".join(["fato"] * count)


def model():
    section = words(40)
    locale = {
        "title": "Um fato conferido na reportagem",
        "description": "A reportagem descreve um fato. O estágio ainda depende do texto original.",
        "whatHappened": section,
        "inPlainTerms": section,
        "whoMayBeAffected": section,
        "whereThingsStand": section,
    }
    return {
        "topics": ["education", "not-a-topic"],
        "subtopics": ["disability"],
        "countries": ["br"],
        "stage": "introduced",
        "locales": {"pt-br": locale},
    }


def item():
    return {
        "id": "abc123",
        "title": "Headline",
        "url": "https://example.com/story",
        "outlet": "Agência Brasil",
        "language": "pt-br",
        "coverage": ["brazil"],
        "publishedAt": "2026-11-26T12:00:00Z",
        "summary": "Short summary",
    }


class DraftTest(unittest.TestCase):
    def test_story_id_is_stable(self):
        self.assertEqual(story_id("abc123"), "q-abc123")

    def test_select_items_skips_known_urls_and_stops_at_the_limit(self):
        first = item()
        second = dict(item(), id="def456", url="https://example.com/other")
        third = dict(item(), id="ghi789", url="https://example.com/third")
        chosen = select_items([first, second, third], {first["url"]}, set(), 1)
        self.assertEqual([entry["id"] for entry in chosen], ["def456"])

    def test_build_story_keeps_only_allowed_fields(self):
        built = build_story(item(), model(), "2026-11-27T04:00:00Z")
        self.assertEqual(built["id"], "q-abc123")
        self.assertEqual(built["meta"]["status"], "published")
        self.assertEqual(built["meta"]["topics"], ["education"])
        self.assertEqual(built["meta"]["countries"], ["BR"])
        self.assertIn("## what-happened", built["markdown"]["pt-br"])
        self.assertNotIn("en", built["markdown"])

    def test_short_article_is_not_drafted(self):
        written = draft_items(
            [item()],
            set(),
            set(),
            extract=lambda url: "too short",
            ask=lambda item, article: model(),
            limit=2,
            reviewed_at="2026-11-27T04:00:00Z",
        )
        self.assertEqual(written, [])

    def test_a_later_article_fills_the_limit_when_the_first_is_short(self):
        first = item()
        second = dict(item(), id="def456", url="https://example.com/other")

        def extract(url):
            return "too short" if url == first["url"] else "word " * 500

        written = draft_items(
            [first, second],
            set(),
            set(),
            extract=extract,
            ask=lambda item, article: model(),
            limit=1,
            reviewed_at="2026-11-27T04:00:00Z",
        )
        self.assertEqual([story["id"] for story in written], ["q-def456"])

    def test_minute_wait_holds_until_tokens_return(self):
        self.assertEqual(minute_wait_seconds({}), 0)
        self.assertEqual(minute_wait_seconds({"x-ratelimit-remaining-tokens": "8000"}), 0)
        self.assertEqual(
            minute_wait_seconds(
                {
                    "x-ratelimit-remaining-tokens": "1000",
                    "x-ratelimit-reset-tokens": "7.4s",
                }
            ),
            7.4,
        )
        self.assertEqual(minute_wait_seconds({"x-ratelimit-remaining-tokens": "1000"}), 60)

    def test_stories_on_day_uses_sao_paulo(self):
        meta = {"locales": {"pt-br": {"reviewedAt": "2026-11-27T05:31:03Z"}}}
        self.assertEqual(reviewed_day(meta), "2026-11-27")
        early = {"locales": {"pt-br": {"reviewedAt": "2026-11-27T02:30:00Z"}}}
        self.assertEqual(stories_on_day([meta, early], "2026-11-27"), 1)

    def test_daily_limit_keeps_stories_already_written(self):
        first = item()
        second = dict(item(), id="def456", url="https://example.com/other")
        calls = {"n": 0}

        def ask(item, article):
            calls["n"] += 1
            if calls["n"] > 1:
                raise GroqError(429, "Rate limit reached for tokens per day")
            return model()

        written = draft_items(
            [first, second],
            set(),
            set(),
            extract=lambda url: "word " * 500,
            ask=ask,
            limit=2,
            reviewed_at="2026-11-27T04:00:00Z",
        )
        self.assertEqual([story["id"] for story in written], ["q-abc123"])


if __name__ == "__main__":
    unittest.main()
