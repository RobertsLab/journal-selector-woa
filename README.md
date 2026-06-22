# Wiley Journal Finder

**Live site:** [https://robertslab.github.io/journal-selector-woa/](https://robertslab.github.io/journal-selector-woa/)

An interactive, single-page website for picking a Wiley journal that fits a
marine-organism / environmental-memory research program. It loads the two
Wiley APC spreadsheets (1,869 journals total, Hybrid OA + Gold OA), scores
each journal against your research themes, and lets you filter and sort by
APC, license, subject, and journal type.

The site is aware of the **UW / BTAA 2026-2027 Wiley Open-Access
Agreement**: for affiliated UW corresponding authors it shows a per-journal
coverage badge, a strikethrough APC with an effective $0 cost, and the
relevant deadline ("Hybrid OA: accept by Dec 31, 2027" or "Gold OA: submit
by Aug 31, 2026"). The banner at the top of the page also shows live
day-countdowns to each deadline.

## Files

- `index.html` - page structure
- `style.css` - styling
- `app.js` - state, scoring, filtering, rendering
- `journals.js` - auto-generated data (1,869 journals)
- `build_data.py` - rebuilds `journals.js` from the two `.xlsx` files
- `Wiley-Journal-APCs-OnlineOpen.xlsx` - Hybrid OA source
- `Wiley-Journal-APCs-Open-Access.xlsx` - Gold OA source

## Open the site

Use the [live site](https://robertslab.github.io/journal-selector-woa/), or run locally:

```bash
open index.html        # macOS - opens directly in your browser
```

or, if your browser blocks `file://` for some reason:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/
```

No build step, no dependencies at runtime.

## Rebuild the data

If Wiley updates the spreadsheets:

```bash
pip3 install --user --break-system-packages openpyxl   # one time
python3 build_data.py
```

This re-reads both `.xlsx` files and rewrites `journals.js`.

## How relevance scoring works

Each journal's `title + subject` is matched against tiered keyword bundles
defined at the top of `app.js`:

| Theme                   | Weight | Default |
| ----------------------- | -----: | :-----: |
| Marine                  |      5 | on      |
| Aquaculture             |      5 | on      |
| Invertebrates           |      4 | on      |
| Climate / Env. change   |      4 | on      |
| Epigenetics             |      4 | on      |
| Ecology / Conservation  |      3 | on      |
| Physiology              |      3 | on      |
| Genomics                |      3 | on      |
| Restoration / Fisheries |      3 | on      |
| Microbiome              |      3 | off     |

A subject-area bonus (+3) is added when the journal's Subject Area string
contains tokens like `aquaculture`, `marine`, `fisheries`, `ecology`,
`environmental`, `evolutionary`, or `comparative biology`.

Free-form keywords (the textarea in the sidebar) contribute +2 each on a
word-boundary match.

To customize the weights or add a theme, edit the `THEMES` array near the
top of `app.js` - no rebuild needed.

## UW / BTAA agreement awareness

Defined at the top of `app.js`:

```js
const BTAA = {
  hybridDeadline: new Date("2027-12-31T23:59:59"),  // Hybrid OA: accept by
  goldDeadline:   new Date("2026-08-31T23:59:59"),  // Gold OA:  submit by
};
```

The site computes each journal's coverage at page-load using today's
date in the user's browser:

- **Hybrid OA journals** are marked "BTAA covered" while today is on or
  before the hybrid deadline. The original APC is shown struck through
  alongside "$0 via BTAA".
- **Gold OA journals** are marked "BTAA covered" only while today is on
  or before the Gold OA submission deadline (Aug 31, 2026). After that,
  central coverage is no longer guaranteed (allocation may also be
  exhausted) and the original APC is shown.

Two sidebar checkboxes let the user steer this:

- "Only show journals currently covered by UW/BTAA" - hard filter.
- "Use BTAA-effective APC (covered = $0) for sorting & cap" - makes the
  Max-APC slider and APC sort treat covered journals as $0. Useful for
  ranking by "what will I actually pay?" rather than list price.

The banner at the top of the page links to:

- [UW Libraries APC Support](https://lib.uw.edu/research-services/publishing/sharing-and-publishing-your-work/article-processing-fees/)
- [UW announcement of the 2026-2027 Wiley agreement](https://lib.uw.edu/2026/04/24/2026-2027-open-access-publishing-agreement-with-wiley/)
- [BTAA Wiley Open Access Agreement page](https://btaa.org/library/open-scholarship/agreements/wiley-open-access-agreement)
- [Wiley Journal Finder by abstract](https://www.wiley.com/en-us/journal-finder/abstract/)
- Contact: <sustainablescholarship@uw.edu>

Eligibility requires you to be the corresponding author on a UW
affiliation; UW Libraries has no central fund for individual APCs.
Always verify coverage with UW Libraries before submission.

## Notes

- APC values come straight from the spreadsheets in USD, GBP, and EUR.
  Switching the currency selector updates all displayed APCs and the
  Max-APC slider's label.
- Journal titles link to the journal's Wiley Online Library homepage
  (taken from the spreadsheet hyperlinks).
- The Gold OA allocation is described by BTAA as "limited"; the site
  flips Gold OA to "APC applies" automatically on Sept 1, 2026, but the
  allocation could be exhausted earlier - confirm with UW Libraries.
