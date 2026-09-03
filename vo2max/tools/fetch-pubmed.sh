#!/usr/bin/env bash
#
# fetch-pubmed.sh — regenerate ../01-why-vo2max-matters/pubmed-data.js
#
# Counts PubMed records per publication year for two search terms, plus the
# total number of records indexed that year (the denominator that turns raw
# counts into a share of the literature).
#
# Uses NCBI E-utilities, which is free and needs no API key below 3 requests
# per second. Run it from this directory:
#
#     ./fetch-pubmed.sh
#
# It takes about two minutes. The generated file records the exact queries and
# the date it was run, so the numbers on the page can always be traced back.
#
# Two things the numbers cannot tell you on their own:
#
#   * The current year is always partially indexed, so END_YEAR must stay at a
#     completed year. Plotting a partial year makes it look like interest
#     collapsed.
#
#   * PubMed only began storing abstracts consistently in 1975 — under 6% of
#     earlier records have one, against over 40% from 1975. A Title/Abstract
#     search therefore finds almost nothing before then, so the chart plots
#     from 1975 even though this script fetches from START_YEAR. The earlier
#     years are kept for the data table.

set -euo pipefail

START_YEAR=1970
END_YEAR=2025
OUT="../01-why-vo2max-matters/pubmed-data.js"

Q_AEROBIC='"aerobic capacity"[Title/Abstract]'
Q_VO2='VO2max[Title/Abstract] OR "VO2 max"[Title/Abstract] OR "maximal oxygen uptake"[Title/Abstract] OR "cardiorespiratory fitness"[Title/Abstract]'
Q_ALL='1900:2100[dp]'

urlenc () { printf '%s' "$1" | od -An -tx1 -v | tr -d '\n ' | sed 's/../%&/g'; }

count () {  # $1 = query, $2 = year
  local q y raw n
  q=$(urlenc "$1"); y="$2"
  for _ in 1 2 3; do
    raw=$(curl -s --max-time 25 \
      "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${q}&mindate=${y}&maxdate=${y}&datetype=pdat&rettype=count" || true)
    n=$(printf '%s' "$raw" | sed -n 's:.*<Count>\([0-9]*\)</Count>.*:\1:p')
    [ -n "$n" ] && { printf '%s' "$n"; return 0; }
    sleep 2
  done
  echo "FAILED for year $y" >&2
  return 1
}

echo "Fetching ${START_YEAR}-${END_YEAR} from PubMed..." >&2
rows=""
for y in $(seq "$START_YEAR" "$END_YEAR"); do
  a=$(count "$Q_AEROBIC" "$y"); sleep 0.35
  v=$(count "$Q_VO2" "$y");     sleep 0.35
  t=$(count "$Q_ALL" "$y");     sleep 0.35
  rows="${rows}  { year: ${y}, aerobic: ${a}, vo2: ${v}, total: ${t} },"$'\n'
  printf '  %s  aerobic=%-5s vo2=%-5s total=%s\n' "$y" "$a" "$v" "$t" >&2
done

cat > "$OUT" <<EOF
/*
 * pubmed-data.js — GENERATED FILE, do not hand-edit.
 *
 * Regenerate with vo2max/tools/fetch-pubmed.sh
 * Fetched: $(date -u +%Y-%m-%d) (UTC)
 * Source:  NCBI E-utilities esearch.fcgi, db=pubmed, datetype=pdat
 *
 * Queries, exactly as sent:
 *   aerobic : ${Q_AEROBIC}
 *   vo2     : ${Q_VO2}
 *   total   : ${Q_ALL}
 *
 * \`total\` is every record PubMed indexed with that publication year. It is
 * the denominator for the "share of the literature" view: raw counts rise
 * partly because PubMed itself grew several times over across this period,
 * and the share view separates real growth in a topic from growth in the
 * database.
 *
 * The series deliberately stops at ${END_YEAR}. The current year is only
 * partially indexed and would render as a collapse in interest that has not
 * happened.
 */

export const PUBMED_META = {
  fetched: '$(date -u +%Y-%m-%d)',
  source: 'NCBI E-utilities (esearch.fcgi), db=pubmed, datetype=pdat',
  url: 'https://www.ncbi.nlm.nih.gov/books/NBK25501/',
  firstYear: ${START_YEAR},
  lastYear: ${END_YEAR},
  queries: {
    aerobic: '${Q_AEROBIC}',
    vo2: '${Q_VO2}',
    total: '${Q_ALL}',
  },
};

export const PUBMED_SERIES = [
${rows}];
EOF

echo "Wrote $OUT" >&2
