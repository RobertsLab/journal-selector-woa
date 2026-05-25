# Wiley Journal Finder

An interactive, single-page website for picking a Wiley journal that fits a
marine-organism / environmental-memory research program. It loads the two
Wiley APC spreadsheets (1,869 journals total, Hybrid OA + Gold OA), scores
each journal against your research themes, and lets you filter and sort by
APC, license, subject, and journal type.

## Files

- `index.html` - page structure
- `style.css` - styling
- `app.js` - state, scoring, filtering, rendering
- `journals.js` - auto-generated data (1,869 journals)
- `build_data.py` - rebuilds `journals.js` from the two `.xlsx` files
- `Wiley-Journal-APCs-OnlineOpen.xlsx` - Hybrid OA source
- `Wiley-Journal-APCs-Open-Access.xlsx` - Gold OA source

## Open the site

Either:

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

## Notes

- APC values come straight from the spreadsheets in USD, GBP, and EUR.
  Switching the currency selector updates all displayed APCs and the
  Max-APC slider's label.
- Journal titles link to the journal's Wiley Online Library homepage
  (taken from the spreadsheet hyperlinks).
- Transformational-agreement / institutional-discount coverage is not in
  the source data, so the site does not show it. Check the linked Wiley
  page or with your librarian.
