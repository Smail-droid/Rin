# Single-Row Gallery Header & Composable Semantic Design Tokens

- **Status**: accepted

We decided to retire the persistent multi-row studio toolbar (`TopAtelierRibbon`) below the site header and converge the frontend onto a **single-row Gallery Top Bar** paired with an on-demand **Appearance Popover**, an **Avatar admin dropdown**, a unified **`PageHeader`** across all primary pages, and **composable semantic surface tokens** in `docs/AESTHETIC_CHARTER.md`.

## Context & Trade-offs

Previously, placing ambience toggles, layout switchers, theme pickers, AI summary toggles, and admin shortcuts in a persistent second/third strip below the header created a three-row header stack on desktop/mobile, leaked homepage-only controls onto subpages, duplicated navigation and volume/tag entries, and locked specific aesthetics into rigid charter prose. Moving global ambience and theme controls into a single top-right Appearance Popover and scoping view/filter controls to each page's `PageHeader` trades one extra click to reveal ambience controls for clean gallery breathing room, strict page-level control scoping, and composable non-hardcoded theming.

## Consequences

- `docs/AESTHETIC_CHARTER.md` specifies architectural boundaries, token contracts, and accessibility contrast baselines rather than hardcoded hex values or mandatory second header bars.
- All primary pages share a single aligned container width and `PageHeader` structure, reducing cross-page misalignment and duplicated back-to-home buttons.
- Any visual preset (`Theme Preset`, `art-title-*`, header layout, font family) must bind to real, observable CSS tokens rather than no-op shell classes.
