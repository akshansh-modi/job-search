#!/usr/bin/env python3
"""Save an application email, with attachments, into Gmail Drafts over IMAP. Never sends.

Same approach as freelance-engine's IMAP adapter: Python's imaplib plus a Gmail app password,
no connector. Put these in .env next to this file (gitignored):
  EMAIL_ADDRESS=you@gmail.com
  EMAIL_APP_PASSWORD=abcd efgh ijkl mnop   # https://myaccount.google.com/apppasswords

Usage:
  python3 save-draft.py --to careers@example.com --subject "..." --body-file body.txt --attach cv.pdf
  python3 save-draft.py ... --dry-run    # build the email and write it to /tmp, don't log in
"""

import argparse
import imaplib
import mimetypes
import re
import ssl
import sys
import time
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
LIST_ROW = re.compile(rb'^\((?P<flags>[^)]*)\) (?:"[^"]*"|NIL) "?(?P<name>.*?)"?$')


def load_env() -> dict:
    env = {}
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.split(" #")[0].strip().strip('"').strip("'")
    return env


def build(sender: str, to: list, subject: str, body: str, attachments: list) -> EmailMessage:
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = sender, ", ".join(to), subject
    msg["Date"], msg["Message-ID"] = formatdate(localtime=True), make_msgid(domain=sender.split("@")[-1])
    msg.set_content(body)
    for p in attachments:
        ctype = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
        main, sub = ctype.split("/", 1)
        msg.add_attachment(p.read_bytes(), maintype=main, subtype=sub, filename=p.name)
    return msg


def drafts_folder(conn: imaplib.IMAP4) -> str:
    """Gmail calls it "[Gmail]/Drafts"; find it by the \\Drafts flag rather than the name."""
    for row in conn.list()[1]:
        if isinstance(row, bytes) and (m := LIST_ROW.match(row)) and rb"\Drafts" in m["flags"].split():
            return m["name"].decode()
    sys.exit("No Drafts folder found on the IMAP server.")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--to", required=True, action="append")
    ap.add_argument("--subject", required=True)
    ap.add_argument("--body-file", required=True, type=Path)
    ap.add_argument("--attach", action="append", default=[], type=Path)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    missing = [str(p) for p in a.attach if not p.is_file()]
    if missing:
        sys.exit(f"Attachment not found: {', '.join(missing)}")

    env = load_env()
    address = env.get("EMAIL_ADDRESS", "").strip().lower()
    password = env.get("EMAIL_APP_PASSWORD", "").replace(" ", "")  # Google shows it in groups of four
    msg = build(address or "me@example.com", a.to, a.subject, a.body_file.read_text(), a.attach)

    if a.dry_run:
        out = Path("/tmp/career-ops-draft.eml")
        out.write_bytes(msg.as_bytes())
        print(f"Dry run: wrote {out} ({len(a.attach)} attachment(s)). Nothing saved to Gmail.")
        return

    if "@" not in address or not password:
        sys.exit("Set EMAIL_ADDRESS and EMAIL_APP_PASSWORD in .env (see the top of this file).")
    host = env.get("EMAIL_IMAP_HOST") or "imap.gmail.com"
    # python.org's macOS Python ships without trusted certificates; macOS keeps its own bundle here.
    cafile = "/etc/ssl/cert.pem" if Path("/etc/ssl/cert.pem").exists() else None
    conn = imaplib.IMAP4_SSL(host, 993, ssl_context=ssl.create_default_context(cafile=cafile), timeout=30)
    try:
        try:
            conn.login(address, password)
        except imaplib.IMAP4.error:
            sys.exit(f"{host} refused the login: check EMAIL_APP_PASSWORD in .env.")
        folder = drafts_folder(conn)
        status, _ = conn.append(f'"{folder}"', r"(\Draft)", imaplib.Time2Internaldate(time.time()), msg.as_bytes())
        if status != "OK":
            sys.exit(f"{host} wouldn't save the draft.")
    finally:
        try:
            conn.logout()
        except (OSError, imaplib.IMAP4.error):
            pass

    search = quote(f"rfc822msgid:{msg['Message-ID'].strip('<>')}", safe="")
    print(f"Draft saved to {folder} (not sent).")
    print(f"Open: https://mail.google.com/mail/u/?authuser={quote(address, safe='')}#search/{search}")


if __name__ == "__main__":
    main()
