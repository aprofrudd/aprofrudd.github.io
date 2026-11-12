#!/usr/bin/env python3
"""Set the Google Scholar citation metrics everywhere the site states them.

    python3 tools/set-metrics.py                      # show what is there now
    python3 tools/set-metrics.py --h-index 28 --citations 1912 --i10 32

The h-index, citation count and i10-index are typed by hand in eleven places
across index.html (name plate, About, Publications stats, the FAQ and its
JSON-LD copy), resume.json and llms.txt. They are Google Scholar's figures,
and Scholar has no feed, so they cannot be fetched: read them off the Scholar
profile and run this.

Why not OpenAlex, which the page already uses for the publication list?
Its counts for the same author are lower (checked November 2026: h-index 23
against 27, 1,335 citations against 1,800+), and the owner chose to keep
Scholar's.

Citations are shown rounded DOWN to the nearest hundred with a plus sign
("1,800+"), so pass the exact count and the script does the rounding. Any
metric you leave out is left alone.

It refuses to write anything unless every place it expects to find is there
exactly as many times as expected, so a reworded sentence fails loudly here
instead of leaving one stale number behind. Standard library only.
"""
import argparse
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (file, metric, expected matches, pattern with ONE capture group: the value)
PLACES = [
    ('index.html', 'h', 1, r'h-index (\d+) &middot;'),
    ('index.html', 'c', 1, r'&middot; ([\d,]+\+) citations &middot;'),
    ('index.html', 'c', 1, r'with over ([\d,]+) citations and an h-index of'),
    ('index.html', 'h', 1, r'citations and an h-index of (\d+), and supervise'),
    ('index.html', 'c', 1, r'<span class="stat-number">([\d,]+\+)</span>\s*<span class="stat-label">Citations</span>'),
    ('index.html', 'h', 1, r'<span class="stat-number">(\d+)</span>\s*<span class="stat-label">h-index</span>'),
    ('index.html', 'i', 1, r'<span class="stat-number">(\d+)</span>\s*<span class="stat-label">i10-index</span>'),
    ('index.html', 'c', 2, r'On Google Scholar his work has over ([\d,]+) citations'),
    ('index.html', 'h', 2, r'citations, with an h-index of (\d+) and i10-index'),
    ('index.html', 'i', 2, r'and i10-index of (\d+)\.'),
    ('resume.json', 'h', 1, r'Google Scholar h-index (\d+)\)'),
    ('llms.txt', 'c', 1, r'^- ([\d,]+\+) citations \(Google Scholar\)$'),
    ('llms.txt', 'h', 1, r'^- h-index: (\d+)$'),
    ('llms.txt', 'i', 1, r'^- i10-index: (\d+)$'),
]


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--h-index', type=int)
    ap.add_argument('--citations', type=int, help='exact count; shown rounded down to the hundred')
    ap.add_argument('--i10', type=int)
    args = ap.parse_args()

    new = {'h': args.h_index, 'c': args.citations, 'i': args.i10}
    for key, value in new.items():
        if value is not None and value < 0:
            sys.exit('Values must be positive.')
    hundreds = None if new['c'] is None else new['c'] // 100 * 100
    if hundreds == 0 and new['c'] is not None:
        sys.exit('Citations under 100 cannot be shown as a rounded "N00+" figure.')

    texts, problems = {}, []
    for name in sorted({p[0] for p in PLACES}):
        with open(os.path.join(ROOT, name), encoding='utf-8') as fh:
            texts[name] = fh.read()

    for name, metric, expected, pattern in PLACES:
        found = re.findall(pattern, texts[name], flags=re.M)
        if len(found) != expected:
            problems.append('%s: expected %d match(es) of /%s/, found %d'
                            % (name, expected, pattern, len(found)))
        else:
            print('%-12s %-9s %s' % (name, {'h': 'h-index', 'c': 'citations', 'i': 'i10-index'}[metric],
                                     ', '.join(found)))
    if problems:
        sys.exit('\nNothing was changed. The wording has moved; update PLACES in this script:\n  '
                 + '\n  '.join(problems))

    if all(v is None for v in new.values()):
        print('\nNo values given, so nothing was changed.')
        return

    for name, metric, expected, pattern in PLACES:
        if new[metric] is None:
            continue

        def swap(match, metric=metric):
            old = match.group(1)
            if metric == 'c':
                value = '{:,}'.format(hundreds) + ('+' if old.endswith('+') else '')
            else:
                value = str(new[metric])
            start, end = match.span(1)
            return match.group(0)[:start - match.start()] + value + match.group(0)[end - match.start():]

        texts[name] = re.sub(pattern, swap, texts[name], flags=re.M)

    for name, text in texts.items():
        with open(os.path.join(ROOT, name), 'w', encoding='utf-8') as fh:
            fh.write(text)
    print('\nUpdated. Check `git diff`, then commit.')


if __name__ == '__main__':
    main()
