#!/usr/bin/env python3
"""
convert-trends.py — turn a Google Trends CSV export into trends-data.js.

Google Trends has no public API, so the data has to come from a manual export:

    1. trends.google.com  ->  search "VO2 max"
    2. Region: Worldwide      Range: 2004 - present
    3. Download CSV  ->  save it as
       vo2max/01-why-vo2max-matters/trends.csv

Then, from this directory:

    ./convert-trends.py

Trends exports look like this: a couple of preamble lines, then a header row
whose first column is Week/Month/Day, then date,value pairs. Values are a
0-100 index of relative search interest, NOT a count of searches -- 100 is
simply the busiest point in the window, so the numbers only mean anything
relative to each other. The chart says so.
"""

import csv
import datetime
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
CSV_PATH = HERE.parent / "01-why-vo2max-matters" / "trends.csv"
OUT_PATH = HERE.parent / "01-why-vo2max-matters" / "trends-data.js"

DATE_RE = re.compile(r"^\d{4}(-\d{2}){0,2}$")


def main() -> int:
    if not CSV_PATH.exists():
        print(f"No CSV found at {CSV_PATH}", file=sys.stderr)
        print("Export one from trends.google.com first - see the notes at the "
              "top of this script.", file=sys.stderr)
        return 1

    rows, term, interval = [], None, "Month"
    with CSV_PATH.open(newline="", encoding="utf-8-sig") as fh:
        for parts in csv.reader(fh):
            if len(parts) < 2:
                continue
            first, second = parts[0].strip(), parts[1].strip()
            # The header row names the interval and the search term.
            if first.lower() in ("week", "month", "day", "time"):
                interval = first.capitalize()
                # "VO2 max: (Worldwide)" -> "VO2 max"
                term = second.split(":")[0].strip() or second
                continue
            if DATE_RE.match(first):
                # Trends writes "<1" for values it rounds below one.
                value = 0.5 if second.startswith("<") else float(second or 0)
                rows.append((first, value))

    if not rows:
        print(f"Parsed no data rows from {CSV_PATH}. Is it a Trends export?",
              file=sys.stderr)
        return 1

    term = term or "search term"
    peak = max(r[1] for r in rows)
    peak_date = next(r[0] for r in rows if r[1] == peak)
    body = "\n".join(f"  ['{d}', {v:g}]," for d, v in rows)

    OUT_PATH.write_text(f'''/*
 * trends-data.js — GENERATED FILE, do not hand-edit.
 *
 * Regenerate with vo2max/tools/convert-trends.py after exporting a fresh CSV
 * from trends.google.com. Converted: {datetime.date.today().isoformat()}
 *
 * Google Trends publishes no API, so this is a manual snapshot rather than a
 * live feed. Values are Google's 0-100 index of RELATIVE search interest: 100
 * marks the busiest point in the window and every other point is scaled
 * against it. They are not counts of searches, and they cannot be compared
 * across separate exports.
 */

export const TRENDS_META = {{
  ready: true,
  term: {term!r},
  interval: {interval!r},
  points: {len(rows)},
  first: {rows[0][0]!r},
  last: {rows[-1][0]!r},
  peak: {peak:g},
  peakDate: {peak_date!r},
  converted: '{datetime.date.today().isoformat()}',
  source: 'https://trends.google.com/trends/explore',
}};

// [date, relative interest 0-100]
export const TRENDS_SERIES = [
{body}
];
'''.replace("'", "'"), encoding="utf-8")

    print(f"Wrote {OUT_PATH}")
    print(f"  term={term!r} interval={interval} points={len(rows)} "
          f"range={rows[0][0]}..{rows[-1][0]} peak={peak:g} at {peak_date}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
