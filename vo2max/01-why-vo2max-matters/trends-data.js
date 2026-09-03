/*
 * trends-data.js — PLACEHOLDER.
 *
 * No Google Trends export has been converted yet. The chart reads `ready` and
 * shows a short "waiting for data" panel instead of a broken figure, so the
 * page is never left in a half-built state.
 *
 * To fill it in:
 *   1. trends.google.com -> search "VO2 max"
 *   2. Region: Worldwide   Range: 2004 - present
 *   3. Download CSV -> save as vo2max/01-why-vo2max-matters/trends.csv
 *   4. cd vo2max/tools && ./convert-trends.py
 *
 * That overwrites this file with the real series.
 */

export const TRENDS_META = { ready: false, term: 'VO₂ max' };
export const TRENDS_SERIES = [];
