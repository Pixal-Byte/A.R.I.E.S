#!/usr/bin/env python3
"""Fetch transmissions from a Nextcloud public share, then rebuild the Radio Room.

Flow: download every top-level .md file in the shared folder into a temporary
folder, then run build_radio.py on it. If anything goes wrong during the
download, the published page is left exactly as it was.

Config (a TOML file kept OUTSIDE the repository, mode 600):

    url   = "https://nextcloud-flux.your-tailnet.ts.net"
    token = "the-share-token"          # the last part of the share link
    # password = "..."                 # only if the share is password-protected

Usage:
    python tools/sync_radio.py --config ~/.config/web-flux/radio.toml
"""

import argparse
import subprocess
import sys
import tempfile
import tomllib
import xml.etree.ElementTree as ET
from pathlib import Path, PurePosixPath
from urllib.parse import quote, unquote, urlsplit

import requests

HERE = Path(__file__).resolve().parent
TIMEOUT = 15                 # seconds, for every request: never wait forever in cron
MAX_FILES = 500              # sanity limits, so a mistake in the share cannot flood the disk
MAX_FILE_BYTES = 200_000

DAV = "{DAV:}"               # ElementTree writes XML namespaces in this form


def die(message):
    sys.exit(f"error: {message}")


def load_config(path):
    try:
        with open(path, "rb") as fh:
            cfg = tomllib.load(fh)
    except FileNotFoundError:
        die(f"config file {path} not found")
    except tomllib.TOMLDecodeError as exc:
        die(f"config file {path} is not valid TOML: {exc}")
    for key in ("url", "token"):
        if not cfg.get(key):
            die(f"config file {path} is missing '{key}'")
    cfg["url"] = cfg["url"].rstrip("/")
    return cfg


def list_markdown_files(session, base):
    """Ask the server what is in the shared folder (one level deep)."""
    response = session.request(
        "PROPFIND", base + "/",
        headers={"Depth": "1", "X-Requested-With": "XMLHttpRequest"},
        timeout=TIMEOUT,
    )
    if response.status_code == 404:
        die("share not found (wrong URL or token, or the share was removed)")
    if response.status_code in (401, 403):
        die(f"access refused ({response.status_code}): is the share password-protected?")
    if response.status_code != 207:  # 207 Multi-Status is the normal WebDAV answer
        die(f"unexpected answer to PROPFIND: HTTP {response.status_code}")

    try:
        tree = ET.fromstring(response.content)
    except ET.ParseError as exc:
        die(f"server did not return valid XML: {exc}")

    names = []
    for item in tree.iter(f"{DAV}response"):
        href = item.findtext(f"{DAV}href")
        if not href:
            continue
        if item.find(f".//{DAV}resourcetype/{DAV}collection") is not None:
            continue  # a folder (including the shared folder itself)
        # Keep only the last path segment, so a hostile server cannot name "../../x".
        name = PurePosixPath(unquote(urlsplit(href).path)).name
        if name.endswith(".md") and not name.startswith("."):
            names.append(name)
    return sorted(set(names))


def download(session, base, name, dest):
    response = session.get(f"{base}/{quote(name)}", timeout=TIMEOUT, stream=True)
    if response.status_code != 200:
        die(f"could not download {name}: HTTP {response.status_code}")
    data = response.raw.read(MAX_FILE_BYTES + 1, decode_content=True)
    if len(data) > MAX_FILE_BYTES:
        die(f"{name} is larger than {MAX_FILE_BYTES} bytes, refusing")
    (dest / name).write_bytes(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0]) # type: ignore
    parser.add_argument("--config", type=Path, default=HERE.parent / "radio.toml")
    parser.add_argument("--output", type=Path,
                        help="write the page here instead of public/radio/index.html (for testing)")
    args = parser.parse_args()

    cfg = load_config(args.config.expanduser())
    base = f"{cfg['url']}/public.php/dav/files/{cfg['token']}"

    session = requests.Session()
    if cfg.get("password"):
        session.auth = ("anonymous", cfg["password"])

    try:
        names = list_markdown_files(session, base)
        if not names:
            die("the share contains no .md files; leaving the page as it is")
        if len(names) > MAX_FILES:
            die(f"{len(names)} files found, more than the limit of {MAX_FILES}")

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            for name in names:
                download(session, base, name, tmp_dir)
            print(f"fetched {len(names)} file(s)")
            command = [sys.executable, str(HERE / "build_radio.py"), "--source", str(tmp_dir)]
            if args.output:
                command += ["--output", str(args.output)]
            result = subprocess.run(command)
    except requests.RequestException as exc:
        die(f"could not reach Nextcloud: {exc}")

    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
