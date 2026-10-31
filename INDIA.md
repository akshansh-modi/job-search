# India add-ons

This fork adds two things to career-ops for job searching in India. Everything else is upstream [career-ops](https://github.com/career-ops-hq/career-ops).

| File | What it does |
|---|---|
| `local/jobspy_parser.py` | Adds **Naukri** and **LinkedIn** searches to `/career-ops scan` via [JobSpy](https://github.com/speedyapply/JobSpy) (runs logged out). |
| `save-draft.py` | Saves an application email with your CV attached into **Gmail Drafts** over IMAP. Python stdlib only, never sends. |

## Naukri / LinkedIn

```bash
python3 -m venv local/jobspy-venv
local/jobspy-venv/bin/pip install "git+https://github.com/speedyapply/JobSpy@68b88d6909a2342ad75fbb945c4204a3a7ed6665"
python3 local/jobspy_parser.py --site naukri --term "java backend developer" --location "Gurugram, India"
```

JobSpy is pinned to a reviewed commit. Review the diff before moving the pin.

Then add entries to `tracked_companies` in `portals.yml`:

```yaml
- name: "Naukri: Java backend (NCR)"
  careers_url: https://www.naukri.com
  scan_method: local_parser
  parser:
    command: python3
    script: local/jobspy_parser.py
    args: ["--site", "naukri", "--term", "java backend developer", "--location", "Gurugram, India"]
    format: jobs-json-v1
  enabled: true
```

Each search takes about 13 seconds (25 results, last 72 hours), under the scanner's 20-second limit per parser. For more coverage add more entries rather than bigger searches.

Naukri and LinkedIn listings can be stale: confirm each role on the employer's own careers page before applying.

## Gmail drafts

1. Turn on 2-Step Verification and create an [app password](https://myaccount.google.com/apppasswords).
2. Add to `.env` in the career-ops folder (it's gitignored):

   ```
   EMAIL_ADDRESS=you@gmail.com
   EMAIL_APP_PASSWORD=abcd efgh ijkl mnop
   ```

3. `python3 save-draft.py --to hr@company.com --subject "..." --body-file email.txt --attach resume.pdf` (add `--dry-run` to test without touching Gmail).
