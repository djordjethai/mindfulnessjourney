from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.new_post import PublishingError, create_post, normalize_date, slugify
from scripts.validate_content import validate_repository


CONFIG = {
    "schemaVersion": 1,
    "contentFormat": "json-html",
    "siteName": "Test Site",
    "baseUrl": "https://example.com",
    "contentDir": "content/posts",
    "pagesDir": "content/pages",
    "mediaDir": "public/wp-content/uploads",
    "mediaPublicPrefix": "/wp-content/uploads/",
    "searchIndex": "public/search-index.json",
    "categories": [{"name": "Mindfulness", "slug": "mindfulness"}],
    "defaultAuthor": "Author",
    "requireDescription": True,
    "requireFeaturedImage": False,
    "contactEmail": "info@example.com",
}


class PublishingHelpersTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        (self.root / "content/posts").mkdir(parents=True)
        (self.root / "content/pages").mkdir(parents=True)
        (self.root / "public/wp-content/uploads").mkdir(parents=True)
        (self.root / "content.config.json").write_text(json.dumps(CONFIG), encoding="utf-8")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def create_valid_post(self, **overrides: str) -> tuple[Path, dict[str, object]]:
        arguments = {
            "title": "Mindfulness & Daily Life: What's Next?",
            "category": "Mindfulness",
            "date": "2026-10-07",
            "description": "A practical mindfulness description.",
            "body_html": "<p>Article body.</p>",
        }
        arguments.update(overrides)
        return create_post(self.root, **arguments)

    def test_slug_generation(self) -> None:
        self.assertEqual(slugify("Mindfulness & Daily Life: What's Next?"), "mindfulness-and-daily-life-whats-next")

    def test_duplicate_slug_is_rejected(self) -> None:
        self.create_valid_post()
        with self.assertRaises(PublishingError):
            self.create_valid_post()

    def test_invalid_category_is_rejected(self) -> None:
        with self.assertRaises(PublishingError):
            self.create_valid_post(category="Unknown")

    def test_invalid_date_is_rejected(self) -> None:
        with self.assertRaises(PublishingError):
            normalize_date("7 October someday")

    def test_created_file_uses_the_repository_schema(self) -> None:
        path, item = self.create_valid_post()
        stored = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(stored, item)
        self.assertEqual(stored["type"], "post")
        self.assertEqual(stored["route"], "/mindfulness-and-daily-life-whats-next/")
        self.assertEqual(stored["categorySlugs"], ["mindfulness"])
        self.assertEqual(stored["date"], "2026-10-07T00:00:00.000Z")

    def test_validator_reports_invalid_content(self) -> None:
        path, _item = self.create_valid_post()
        invalid = json.loads(path.read_text(encoding="utf-8"))
        invalid.pop("title")
        path.write_text(json.dumps(invalid), encoding="utf-8")
        issues, _items = validate_repository(self.root)
        self.assertTrue(any("missing required fields: title" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()
