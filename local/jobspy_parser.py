#!/usr/bin/env python3
"""career-ops local parser: one JobSpy search (Naukri / LinkedIn) -> {"jobs": [...]} on stdout.

Wired in portals.yml as scan_method: local_parser, so scan.mjs applies the usual title/location/
age filters, dedups against scan-history and writes data/pipeline.md.

JobSpy (MIT, github.com/speedyapply/JobSpy) is installed in local/jobspy-venv, pinned to commit
68b88d6, which was security-reviewed on 2026-10-30. Upgrade by re-reviewing, then reinstalling at
the new commit.

  python3 local/jobspy_parser.py --site naukri --term "java backend developer" --location "Gurugram, India"
"""

import argparse
import json
import os
import sys
from pathlib import Path

VENV_PY = Path(__file__).resolve().parent / "jobspy-venv" / "bin" / "python"

try:
    from jobspy import scrape_jobs
except ImportError:
    # Started by scan.mjs as plain `python3`: switch into the JobSpy venv once.
    # The venv python is a symlink to the system one, so compare prefixes, not resolved paths.
    if VENV_PY.exists() and sys.prefix == sys.base_prefix:
        os.execv(str(VENV_PY), [str(VENV_PY), "-I", __file__, *sys.argv[1:]])
    sys.exit("jobspy not installed: run local/jobspy-venv/bin/pip install python-jobspy")

# ponytail: 25 results x 72h per search keeps each run ~13s, under scan.mjs's 20s parser timeout.
# More volume = more portals.yml entries, not bigger searches.
ap = argparse.ArgumentParser()
ap.add_argument("--site", required=True, choices=["naukri", "linkedin", "indeed"])
ap.add_argument("--term", required=True)
ap.add_argument("--location", required=True)
ap.add_argument("--results", type=int, default=25)
ap.add_argument("--hours", type=int, default=72)
a = ap.parse_args()

df = scrape_jobs(
    site_name=[a.site], search_term=a.term, location=a.location,
    results_wanted=a.results, hours_old=a.hours, country_indeed="India", verbose=0,
)


def clean(v):
    # pandas fills missing cells with NaN, which JSON can't carry
    return None if v is None or v != v else str(v)


jobs = []
for r in df.to_dict("records"):
    url, title = clean(r.get("job_url")), clean(r.get("title"))
    if not url or not title:
        continue
    jobs.append({
        "title": title,
        "url": url,
        "company": clean(r.get("company")) or "",
        "location": clean(r.get("location")) or "",
        "postedAt": clean(r.get("date_posted")),
    })
print(json.dumps({"jobs": jobs}))
