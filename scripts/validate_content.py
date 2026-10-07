from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from datetime import datetime
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parents[1]
REQUIRED_FIELDS = {
    "id", "type", "title", "slug", "date", "modified", "author", "excerpt",
    "contentHtml", "categories", "categorySlugs", "tags", "tagSlugs", "oldUrl", "route",
}
WORDPRESS_RUNTIME = re.compile(r"/wp-admin/|/wp-json/|wp-comments-post\.php", re.IGNORECASE)


class ContentParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[str] = []
        self.media: list[str] = []
        self.text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "a" and values.get("href"):
            self.links.append(values["href"] or "")
        if tag in {"img", "source", "video", "audio"} and values.get("src"):
            self.media.append(values["src"] or "")

    def handle_data(self, data: str) -> None:
        self.text.append(data)


def load_config(root: Path = ROOT) -> dict[str, Any]:
    return json.loads((root / "content.config.json").read_text(encoding="utf-8"))


def read_items(root: Path, config: dict[str, Any]) -> tuple[list[tuple[Path, dict[str, Any]]], list[str]]:
    items: list[tuple[Path, dict[str, Any]]] = []
    issues: list[str] = []
    for key in ("contentDir", "pagesDir"):
        directory = root / config[key]
        if not directory.is_dir():
            issues.append(f"{key}: missing directory {directory.relative_to(root)}")
            continue
        for file_path in sorted(directory.glob("*.json")):
            try:
                value = json.loads(file_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as error:
                issues.append(f"{file_path.relative_to(root)}: invalid JSON: {error}")
                continue
            if not isinstance(value, dict):
                issues.append(f"{file_path.relative_to(root)}: top-level JSON value must be an object")
                continue
            items.append((file_path, value))
    return items, issues


def valid_iso_date(value: Any) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return parsed.tzinfo is not None


def local_public_target(root: Path, public_path: str) -> Path:
    return root / "public" / unquote(public_path.split("?", 1)[0].split("#", 1)[0]).lstrip("/")


def normalize_route(path: str) -> str:
    clean = unquote(path).split("?", 1)[0].split("#", 1)[0]
    if not clean.startswith("/"):
        clean = "/" + clean
    if Path(clean).suffix:
        return clean
    return clean.rstrip("/") + "/" if clean != "/" else "/"


def inspect_url(*, root: Path, config: dict[str, Any], source: str, value: str, routes: set[str], media: bool) -> list[str]:
    issues: list[str] = []
    if not value or value.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
        return issues
    if any(character.isspace() for character in value):
        return [f"{source}: malformed URL contains whitespace: {value}"]
    parsed = urlparse(value)
    if parsed.scheme and (parsed.scheme not in {"http", "https"} or not parsed.netloc):
        return [f"{source}: malformed URL: {value}"]
    if "localhost" in parsed.netloc.casefold() or parsed.hostname in {"127.0.0.1", "::1"}:
        issues.append(f"{source}: localhost URL is not publishable: {value}")
    if WORDPRESS_RUNTIME.search(parsed.path):
        issues.append(f"{source}: depends on an old WordPress runtime URL: {value}")

    site_host = urlparse(config["baseUrl"]).hostname
    if parsed.netloc and parsed.hostname not in {site_host, f"www.{site_host}"}:
        return issues
    path = parsed.path or value.split("?", 1)[0].split("#", 1)[0]
    if media or Path(path).suffix:
        if path.startswith("/") and not local_public_target(root, path).is_file():
            issues.append(f"{source}: referenced local file does not exist: {path}")
        return issues
    route = normalize_route(path)
    if route not in routes:
        issues.append(f"{source}: internal route does not exist: {route}")
    return issues


def validate_repository(root: Path = ROOT) -> tuple[list[str], list[dict[str, Any]]]:
    try:
        config = load_config(root)
    except (OSError, json.JSONDecodeError) as error:
        return [f"content.config.json: {error}"], []
    entries, issues = read_items(root, config)
    items = [item for _, item in entries]
    allowed_categories = {category["name"]: category["slug"] for category in config["categories"]}
    slugs: Counter[str] = Counter()
    routes: Counter[str] = Counter()
    ids: Counter[int] = Counter()
    tag_counts: Counter[tuple[str, str]] = Counter()

    for file_path, item in entries:
        source = file_path.relative_to(root).as_posix()
        missing = sorted(REQUIRED_FIELDS - item.keys())
        if missing:
            issues.append(f"{source}: missing required fields: {', '.join(missing)}")
        if item.get("type") not in {"post", "page"}:
            issues.append(f"{source}: type must be 'post' or 'page'")
        for field in ("title", "slug", "author", "oldUrl", "route"):
            if not isinstance(item.get(field), str) or not item[field].strip():
                issues.append(f"{source}: {field} must be a non-empty string")
        for field in ("date", "modified"):
            if not valid_iso_date(item.get(field)):
                issues.append(f"{source}: {field} must be a timezone-aware ISO 8601 timestamp")
        if isinstance(item.get("slug"), str):
            slugs[item["slug"]] += 1
        if isinstance(item.get("route"), str):
            routes[normalize_route(item["route"])] += 1
        if isinstance(item.get("id"), int):
            ids[item["id"]] += 1
        else:
            issues.append(f"{source}: id must be an integer")

        categories = item.get("categories")
        category_slugs = item.get("categorySlugs")
        if not isinstance(categories, list) or not isinstance(category_slugs, list):
            issues.append(f"{source}: categories and categorySlugs must be arrays")
        elif len(categories) != len(category_slugs):
            issues.append(f"{source}: categories and categorySlugs must have matching lengths")
        else:
            for name, slug in zip(categories, category_slugs, strict=True):
                if allowed_categories.get(name) != slug:
                    issues.append(f"{source}: invalid category mapping: {name!r} -> {slug!r}")

        tags = item.get("tags")
        tag_slugs = item.get("tagSlugs")
        if not isinstance(tags, list) or not isinstance(tag_slugs, list) or len(tags) != len(tag_slugs):
            issues.append(f"{source}: tags and tagSlugs must be arrays with matching lengths")
        elif item.get("type") == "post":
            for name, slug in zip(tags, tag_slugs, strict=True):
                tag_counts[(str(name), str(slug))] += 1

        if config.get("requireDescription") and not str(item.get("seoDescription") or item.get("excerpt") or "").strip():
            issues.append(f"{source}: an SEO description or excerpt is required")
        featured_image = item.get("featuredImage")
        if config.get("requireFeaturedImage") and not featured_image:
            issues.append(f"{source}: featuredImage is required")
        if featured_image:
            issues.extend(inspect_url(root=root, config=config, source=source, value=str(featured_image), routes=set(), media=True))

    for value, count in slugs.items():
        if count > 1:
            issues.append(f"duplicate slug: {value} ({count} content items)")
    for value, count in routes.items():
        if count > 1:
            issues.append(f"duplicate route: {value} ({count} content items)")
    for value, count in ids.items():
        if count > 1:
            issues.append(f"duplicate content id: {value} ({count} content items)")

    known_routes = set(routes)
    known_routes.add("/search/")
    known_routes.update(f"/category/{category['slug']}/" for category in config["categories"])
    known_routes.update(f"/tag/{slug}/" for (_name, slug), count in tag_counts.items() if count >= 4)
    for route in {"/search/", "/robots.txt", "/sitemap.xml"}:
        if route in routes:
            issues.append(f"content route conflicts with generated route: {route}")

    for file_path, item in entries:
        source = file_path.relative_to(root).as_posix()
        parser = ContentParser()
        try:
            parser.feed(str(item.get("contentHtml") or ""))
        except Exception as error:
            issues.append(f"{source}: contentHtml could not be parsed: {error}")
            continue
        for link in parser.links:
            issues.extend(inspect_url(root=root, config=config, source=source, value=link, routes=known_routes, media=False))
        for media_url in parser.media:
            issues.extend(inspect_url(root=root, config=config, source=source, value=media_url, routes=known_routes, media=True))
    return issues, items


def plain_text(html: str) -> str:
    parser = ContentParser()
    parser.feed(html)
    return re.sub(r"\s+", " ", unescape("".join(parser.text))).strip()


def sync_search_index(root: Path, config: dict[str, Any], items: list[dict[str, Any]]) -> Path:
    publishable = {
        item["route"]: item
        for item in items
        if item.get("type") == "post" or (item.get("type") == "page" and item.get("route") != "/")
    }
    ordered_items: list[dict[str, Any]] = []
    seen: set[str] = set()
    migration_map = root / "migration/url-map.json"
    if migration_map.is_file():
        for entry in json.loads(migration_map.read_text(encoding="utf-8")):
            new_url = entry.get("new_url")
            if not new_url:
                continue
            route = normalize_route(urlparse(new_url).path)
            if route in publishable and route not in seen:
                ordered_items.append(publishable[route])
                seen.add(route)
    ordered_items.extend(
        sorted(
            (item for route, item in publishable.items() if route not in seen),
            key=lambda item: (item["date"], item["slug"]),
        )
    )
    index = [
        {
            "title": item["title"],
            "slug": item["route"],
            "excerpt": item.get("excerpt", ""),
            "categories": item.get("categories", []),
            "body": plain_text(item.get("contentHtml", "")),
        }
        for item in ordered_items
    ]
    target = root / config["searchIndex"]
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Mindfulness Journey JSON content.")
    parser.add_argument("--sync-search-index", action="store_true", help="Regenerate the derived search index after validation.")
    args = parser.parse_args()
    issues, items = validate_repository(ROOT)
    if issues:
        print(f"Content validation failed with {len(issues)} issue(s):")
        for issue in issues:
            print(f"- {issue}")
        return 1
    print(f"Content validation passed for {len(items)} item(s).")
    if args.sync_search_index:
        target = sync_search_index(ROOT, load_config(ROOT), items)
        print(f"Regenerated: {target.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
