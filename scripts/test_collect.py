import unittest

from collect import item_id, normalize_url, parse_feed, plain_text


class CollectTest(unittest.TestCase):
    def test_normalize_url_drops_tracking_and_fragments(self):
        raw = "HTTPS://Example.com/a/?b=2&utm_source=x&a=1#section"
        self.assertEqual(normalize_url(raw), "https://example.com/a?a=1&b=2")

    def test_same_story_keeps_one_id(self):
        left = item_id("https://example.com/story/?utm_medium=rss")
        right = item_id("https://example.com/story")
        self.assertEqual(left, right)

    def test_plain_text_strips_markup_and_limits_length(self):
        text = plain_text("<p>Hello &amp; welcome</p>")
        self.assertEqual(text, "Hello & welcome")

    def test_parse_rss_item(self):
        xml = """<?xml version="1.0"?>
        <rss version="2.0"><channel>
          <item>
            <title>A headline</title>
            <link>https://example.com/a?utm_source=feed</link>
            <pubDate>Thu, 26 Nov 2026 12:00:00 GMT</pubDate>
            <description><![CDATA[<p>Short summary.</p>]]></description>
          </item>
        </channel></rss>
        """
        items = parse_feed(xml)
        self.assertEqual(items[0]["title"], "A headline")
        self.assertEqual(items[0]["url"], "https://example.com/a")
        self.assertEqual(items[0]["summary"], "Short summary.")
        self.assertTrue(items[0]["publishedAt"].startswith("2026-11-26T12:00:00"))


if __name__ == "__main__":
    unittest.main()
