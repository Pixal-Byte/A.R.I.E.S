#!/usr/bin/env python3
"""Build public/radio/index.html from a folder of Markdown transmissions.

Each transmission is one .md file:

    2026-11-16-crew-quarters-open.md      <- the date comes from the filename

    # Crew quarters open                  <- the first heading is the title

    Body paragraphs, written in Markdown.

    Tags: update, site                    <- optional last line

Usage:
    python tools/build_radio.py --source tools/sample-transmissions
"""

import argparse
import os
import re
import sys
import tempfile
from datetime import date
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from markdown_it import MarkdownIt

# The repository root is the folder above tools/, wherever the script is run from.
ROOT = Path(__file__).resolve().parent.parent

# "2026-11-16-some-slug.md": capture the date part and require a slug after it.
FILENAME_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})-.+\.md$")

# A line such as "Tags: update, site" (case-insensitive).
TAGS_RE = re.compile(r"^tags:\s*(.+)$", re.IGNORECASE)

# html=False turns any raw HTML in a .md file into escaped text instead of
# passing it through. That is what makes it safe to insert the result with |safe.
MD = MarkdownIt("commonmark", {"html": False})


def warn(message):
    print(f"warning: {message}", file=sys.stderr)


def parse_transmission(path):
    """Turn one .md file into a dict for the template, or return None to skip it."""
    match = FILENAME_RE.match(path.name)
    if not match:
        warn(f"skipping {path.name}: filename must look like YYYY-MM-DD-slug.md")
        return None

    try:
        when = date.fromisoformat(match.group(1))
    except ValueError:
        warn(f"skipping {path.name}: {match.group(1)} is not a real date")
        return None

    lines = path.read_text(encoding="utf-8").strip().splitlines()

    # Optional tags line: the last non-empty line, if it starts with "Tags:".
    tags = []
    while lines and not lines[-1].strip():
        lines.pop()
    if lines:
        tags_match = TAGS_RE.match(lines[-1].strip())
        if tags_match:
            tags = [t.strip() for t in tags_match.group(1).split(",") if t.strip()]
            lines.pop()

    # Title: the first heading. It is removed from the body so it is not shown twice.
    while lines and not lines[0].strip():
        lines.pop(0)
    if lines and lines[0].startswith("# "):
        title = lines.pop(0)[2:].strip()
    else:
        title = path.stem[11:].replace("-", " ").capitalize()
        warn(f"{path.name} has no '# Title' line, using '{title}'")

    return {
        "date": when,
        "date_human": f"{when.day} {when:%b} {when.year}",
        "title": title,
        "tags": tags,
        "html": MD.render("\n".join(lines)),
    }


def write_if_changed(output, content):
    """Write the file atomically, and leave it alone if nothing changed."""
    if output.exists() and output.read_text(encoding="utf-8") == content:
        print(f"{output}: unchanged")
        return

    output.parent.mkdir(parents=True, exist_ok=True)
    # Write to a temporary file in the same folder, then swap it into place in one
    # step. A visitor never gets a half-written page.
    fd, tmp_name = tempfile.mkstemp(dir=output.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as tmp:
            tmp.write(content)
        os.chmod(tmp_name, 0o644)  # mkstemp creates files readable by the owner only
        os.replace(tmp_name, output)
    except BaseException:
        os.unlink(tmp_name)
        raise
    print(f"{output}: written")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0]) # type: ignore
    parser.add_argument("--source", required=True, type=Path,
                        help="folder containing the .md transmissions")
    parser.add_argument("--template", type=Path,
                        default=ROOT / "templates" / "radio.html.j2")
    parser.add_argument("--output", type=Path,
                        default=ROOT / "public" / "radio" / "index.html")
    args = parser.parse_args()

    if not args.source.is_dir():
        sys.exit(f"error: {args.source} is not a folder")

    parsed = (parse_transmission(p) for p in sorted(args.source.glob("*.md")))
    transmissions = [t for t in parsed if t is not None]

    # Refuse to publish an empty log: if a fetch from Nextcloud failed and left an
    # empty folder, the page would otherwise be wiped.
    if not transmissions:
        sys.exit(f"error: no valid transmissions in {args.source}; leaving the page as it is")

    # Number them oldest = 1, then show newest first.
    transmissions.sort(key=lambda t: t["date"])
    for number, tx in enumerate(transmissions, start=1):
        tx["num"] = number
    transmissions.reverse()

    env = Environment(
        loader=FileSystemLoader(args.template.parent),
        autoescape=True,  # escape titles and tags (the body is already-safe HTML)
        keep_trailing_newline=True,
    )
    page = env.get_template(args.template.name).render(transmissions=transmissions)
    write_if_changed(args.output, page)


if __name__ == "__main__":
    main()