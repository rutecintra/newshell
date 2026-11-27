import unittest

from draft import build_story, draft_items, select_items, story_id


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
    english = dict(locale)
    english["title"] = "A fact checked against the report"
    english["description"] = "The report describes a fact. The stage still depends on the original text."
    return {
        "topics": ["education", "not-a-topic"],
        "subtopics": ["disability"],
        "countries": ["br"],
        "stage": "introduced",
        "locales": {"pt-br": locale, "en": english},
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
        self.assertEqual(built["meta"]["status"], "draft")
        self.assertEqual(built["meta"]["topics"], ["education"])
        self.assertEqual(built["meta"]["countries"], ["BR"])
        self.assertIn("## what-happened", built["markdown"]["pt-br"])
        self.assertIn("## where-things-stand", built["markdown"]["en"])

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


if __name__ == "__main__":
    unittest.main()
