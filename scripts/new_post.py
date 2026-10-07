from __future__ import annotations

import argparse
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse


ROOT = Path(__file__).resolve().parents[1]


class PublishingError(ValueError):
    """Raised when a post cannot be safely created."""


def load_config(root: Path = ROOT) -> dict[str, Any]:
    return json.loads((root / "content.config.json").read_text(encoding="utf-8"))


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.replace("&", " and ").replace("'", "").replace("’", ""))
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")
    if not slug:
        raise PublishingError("The title does not produce a usable slug.")
    return slug


def normalize_date(value: str | None) -> str:
    if not value:
        parsed = datetime.now(timezone.utc)
    else:
        candidate = value.strip()
        try:
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", candidate):
                parsed = datetime.strptime(candidate, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            else:
                parsed = datetime.fromisoformat(candidate.replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                parsed = parsed.astimezone(timezone.utc)
        except ValueError as error:
            raise PublishingError(f"Invalid date: {value}. Use YYYY-MM-DD or an ISO 8601 timestamp.") from error
    return parsed.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def resolve_category(config: dict[str, Any], value: str) -> dict[str, str]:
    requested = value.strip().casefold()
    for category in config["categories"]:
        if requested in {category["name"].casefold(), category["slug"].casefold()}:
            return {"name": category["name"], "slug": category["slug"]}
    allowed = ", ".join(category["name"] for category in config["categories"])
    raise PublishingError(f"Invalid category: {value}. Allowed categories: {allowed}")


def iter_content(root: Path, config: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for key in ("contentDir", "pagesDir"):
        for file_path in sorted((root / config[key]).glob("*.json")):
            items.append(json.loads(file_path.read_text(encoding="utf-8")))
    return items


def validate_image(root: Path, config: dict[str, Any], image: str | None) -> str | None:
    if not image:
        return None
    value = image.strip().replace("\\", "/")
    parsed = urlparse(value)
    if parsed.scheme:
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise PublishingError("Featured image must be a valid HTTP(S) URL or a local public path.")
        return value
    if not value.startswith(config["mediaPublicPrefix"]):
        raise PublishingError(f"Local featured images must use {config['mediaPublicPrefix']} paths.")
    target = root / "public" / value.lstrip("/")
    if not target.is_file():
        raise PublishingError(f"Featured image does not exist: {value}")
    return value


def create_post(
    root: Path,
    *,
    title: str,
    category: str,
    date: str | None,
    description: str,
    image: str | None = None,
    slug: str | None = None,
    body_html: str = "",
) -> tuple[Path, dict[str, Any]]:
    config = load_config(root)
    clean_title = title.strip()
    clean_description = description.strip()
    if not clean_title:
        raise PublishingError("Title is required.")
    if config.get("requireDescription") and not clean_description:
        raise PublishingError("SEO description is required.")

    post_slug = slugify(slug or clean_title)
    category_data = resolve_category(config, category)
    published_at = normalize_date(date)
    featured_image = validate_image(root, config, image)
    route = f"/{post_slug}/"
    items = iter_content(root, config)
    if any(item.get("slug") == post_slug or item.get("route") == route for item in items):
        raise PublishingError(f"A content item already uses slug or route '{post_slug}'.")

    numeric_ids = [item.get("id") for item in items if isinstance(item.get("id"), int) and item["id"] >= 0]
    item: dict[str, Any] = {
        "id": max(numeric_ids, default=0) + 1,
        "type": "post",
        "title": clean_title,
        "slug": post_slug,
        "date": published_at,
        "modified": published_at,
        "author": config["defaultAuthor"],
        "excerpt": clean_description,
        "contentHtml": body_html.strip(),
        "categories": [category_data["name"]],
        "categorySlugs": [category_data["slug"]],
        "tags": [],
        "tagSlugs": [],
        "seoDescription": clean_description,
        "oldUrl": urljoin(config["baseUrl"].rstrip("/") + "/", route.lstrip("/")),
        "route": route,
    }
    if featured_image:
        item["featuredImage"] = featured_image
        item["featuredImageAlt"] = clean_title

    output_path = root / config["contentDir"] / f"{post_slug}.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with output_path.open("x", encoding="utf-8", newline="\n") as handle:
            json.dump(item, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
    except FileExistsError as error:
        raise PublishingError(f"Refusing to overwrite existing file: {output_path}") from error
    return output_path, item


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Create a Mindfulness Journey post JSON file.")
    parser.add_argument("--title")
    parser.add_argument("--category")
    parser.add_argument("--date")
    parser.add_argument("--description")
    parser.add_argument("--image")
    parser.add_argument("--slug")
    parser.add_argument("--body-file", help="Optional UTF-8 file containing the article body as HTML.")
    return parser


def prompt(value: str | None, label: str, default: str | None = None) -> str:
    if value is not None:
        return value
    suffix = f" [{default}]" if default else ""
    entered = input(f"{label}{suffix}: ").strip()
    return entered or (default or "")


def main() -> int:
    args = build_parser().parse_args()
    today = datetime.now(timezone.utc).date().isoformat()
    title = prompt(args.title, "Title")
    category = prompt(args.category, "Category")
    date = prompt(args.date, "Date", today)
    description = prompt(args.description, "SEO description")
    image = prompt(args.image, "Featured image (optional)")
    body_html = Path(args.body_file).read_text(encoding="utf-8") if args.body_file else ""
    try:
        output_path, item = create_post(
            ROOT,
            title=title,
            category=category,
            date=date,
            description=description,
            image=image,
            slug=args.slug,
            body_html=body_html,
        )
    except (PublishingError, OSError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}")
        return 1
    config = load_config(ROOT)
    print(f"Created: {output_path.relative_to(ROOT)}")
    print(f"URL: {urljoin(config['baseUrl'].rstrip('/') + '/', item['route'].lstrip('/'))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
