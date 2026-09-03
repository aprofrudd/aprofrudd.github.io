/*
 * pubmed-data.js — GENERATED FILE, do not hand-edit.
 *
 * Regenerate with vo2max/tools/fetch-pubmed.sh
 * Fetched: 2026-09-03 (UTC)
 * Source:  NCBI E-utilities esearch.fcgi, db=pubmed, datetype=pdat
 *
 * Queries, exactly as sent:
 *   aerobic : "aerobic capacity"[Title/Abstract]
 *   vo2     : VO2max[Title/Abstract] OR "VO2 max"[Title/Abstract] OR "maximal oxygen uptake"[Title/Abstract] OR "cardiorespiratory fitness"[Title/Abstract]
 *   total   : 1900:2100[dp]
 *
 * `total` is every record PubMed indexed with that publication year. It is
 * the denominator for the "share of the literature" view: raw counts rise
 * partly because PubMed itself grew several times over across this period,
 * and the share view separates real growth in a topic from growth in the
 * database.
 *
 * The series deliberately stops at 2025. The current year is only
 * partially indexed and would render as a collapse in interest that has not
 * happened.
 */

export const PUBMED_META = {
  fetched: '2026-09-03',
  source: 'NCBI E-utilities (esearch.fcgi), db=pubmed, datetype=pdat',
  url: 'https://www.ncbi.nlm.nih.gov/books/NBK25501/',
  firstYear: 1970,
  lastYear: 2025,
  queries: {
    aerobic: '"aerobic capacity"[Title/Abstract]',
    vo2: 'VO2max[Title/Abstract] OR "VO2 max"[Title/Abstract] OR "maximal oxygen uptake"[Title/Abstract] OR "cardiorespiratory fitness"[Title/Abstract]',
    total: '1900:2100[dp]',
  },
};

export const PUBMED_SERIES = [
  { year: 1970, aerobic: 6, vo2: 6, total: 219425 },
  { year: 1971, aerobic: 8, vo2: 14, total: 223658 },
  { year: 1972, aerobic: 6, vo2: 5, total: 227949 },
  { year: 1973, aerobic: 8, vo2: 5, total: 231157 },
  { year: 1974, aerobic: 5, vo2: 15, total: 235131 },
  { year: 1975, aerobic: 14, vo2: 78, total: 249242 },
  { year: 1976, aerobic: 14, vo2: 83, total: 255030 },
  { year: 1977, aerobic: 16, vo2: 81, total: 262234 },
  { year: 1978, aerobic: 17, vo2: 96, total: 272609 },
  { year: 1979, aerobic: 15, vo2: 93, total: 282189 },
  { year: 1980, aerobic: 22, vo2: 117, total: 280699 },
  { year: 1981, aerobic: 19, vo2: 121, total: 283695 },
  { year: 1982, aerobic: 32, vo2: 155, total: 295825 },
  { year: 1983, aerobic: 30, vo2: 149, total: 309585 },
  { year: 1984, aerobic: 49, vo2: 216, total: 318317 },
  { year: 1985, aerobic: 52, vo2: 193, total: 335442 },
  { year: 1986, aerobic: 48, vo2: 211, total: 349819 },
  { year: 1987, aerobic: 54, vo2: 240, total: 368059 },
  { year: 1988, aerobic: 51, vo2: 254, total: 387105 },
  { year: 1989, aerobic: 67, vo2: 288, total: 402906 },
  { year: 1990, aerobic: 51, vo2: 293, total: 410999 },
  { year: 1991, aerobic: 57, vo2: 339, total: 413322 },
  { year: 1992, aerobic: 66, vo2: 370, total: 418129 },
  { year: 1993, aerobic: 79, vo2: 351, total: 427785 },
  { year: 1994, aerobic: 65, vo2: 324, total: 439239 },
  { year: 1995, aerobic: 89, vo2: 341, total: 449343 },
  { year: 1996, aerobic: 72, vo2: 356, total: 458817 },
  { year: 1997, aerobic: 89, vo2: 365, total: 456896 },
  { year: 1998, aerobic: 95, vo2: 395, total: 474778 },
  { year: 1999, aerobic: 74, vo2: 357, total: 493927 },
  { year: 2000, aerobic: 80, vo2: 371, total: 532636 },
  { year: 2001, aerobic: 88, vo2: 351, total: 547644 },
  { year: 2002, aerobic: 106, vo2: 398, total: 565486 },
  { year: 2003, aerobic: 103, vo2: 384, total: 594602 },
  { year: 2004, aerobic: 109, vo2: 371, total: 639789 },
  { year: 2005, aerobic: 127, vo2: 492, total: 700540 },
  { year: 2006, aerobic: 130, vo2: 533, total: 750390 },
  { year: 2007, aerobic: 126, vo2: 579, total: 786776 },
  { year: 2008, aerobic: 174, vo2: 528, total: 837236 },
  { year: 2009, aerobic: 193, vo2: 623, total: 877685 },
  { year: 2010, aerobic: 205, vo2: 659, total: 942369 },
  { year: 2011, aerobic: 226, vo2: 741, total: 1020845 },
  { year: 2012, aerobic: 266, vo2: 793, total: 1090502 },
  { year: 2013, aerobic: 264, vo2: 918, total: 1150126 },
  { year: 2014, aerobic: 326, vo2: 1004, total: 1205918 },
  { year: 2015, aerobic: 361, vo2: 1075, total: 1258163 },
  { year: 2016, aerobic: 367, vo2: 1063, total: 1285532 },
  { year: 2017, aerobic: 377, vo2: 1084, total: 1304378 },
  { year: 2018, aerobic: 344, vo2: 1158, total: 1351712 },
  { year: 2019, aerobic: 383, vo2: 1336, total: 1418998 },
  { year: 2020, aerobic: 415, vo2: 1447, total: 1641241 },
  { year: 2021, aerobic: 473, vo2: 1548, total: 1787583 },
  { year: 2022, aerobic: 472, vo2: 1582, total: 1783559 },
  { year: 2023, aerobic: 399, vo2: 1390, total: 1697836 },
  { year: 2024, aerobic: 423, vo2: 1469, total: 1739765 },
  { year: 2025, aerobic: 480, vo2: 1584, total: 1882137 },
];
