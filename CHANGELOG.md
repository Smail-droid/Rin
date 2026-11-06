# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.0.5] - 2026-11-07

### Added
- **Kawaii Floating Music Note Player**: Replaced pixelated system emojis with handcrafted anime vector dual-note SVG in soft coral-pink gradient (`#FF7E95` to `#FFA6B7`). Features a 100% transparent floating background, 8-second slow clockwise rotation during playback, breathing micro-glow, and click-to-expand/collapse control bar.
- **Floating Upper Lyrics & No-BG Control Buttons**: Floating song title and synced LRC lyrics displayed without background boxes (`#503E42` warm brown and `#FF7E95` pink). Control buttons are stripped of solid background cards, with an embedded 2px delicate pink progress bar and Click-outside auto-closing playlist drawer.
- **R2 Music Metadata Persistence (`music/metadata.json`)**: Solved cover loss when updating large 40MB audio files by establishing a dedicated 10KB metadata index. Changing covers and titles takes 15ms without re-uploading large audio binaries, surviving every `Ctrl + F5` force refresh.
- **Audio Quality Auto-Detection**: Integrated automatic audio stream detection labeling FLAC lossless, 320K high quality, WAV master, and Hi-Res badges.
- **Navidrome Album Grid 4-Corner Interactions & Column Density Switcher**: Album artwork cards feature top-left cover replacement, top-right physical deletion, center play/pause, bottom-left playlist status, and bottom-right audio quality badge. Added seamless 6-col / 8-col / 10-col layout switching.
- **Direct Numeric Sorting for Tables**: Replaced cumbersome drag-and-drop with direct numeric input on row numbers in both Music Playlist and Tag Management (`/admin/tags`). Typing `3` on item 14 immediately moves it to position 3 while subsequent rows smoothly shift down by 1.
- **Dashboard Full-Spectrum Super Table Overhaul**: Upgraded `/admin/dashboard` table to match `/admin/queue-status` with 44×44 cover preview, hover replacement dialog, in-place quick editing modal, permission lock dialog, pin/unpin buttons, and standard pagination.
- **SEO Enhancements**: Added custom `footer.by_text` and `footer.by_url` configuration, plus blog favicon upload card with official 512×512 PNG/SVG specification advice.

### Changed
- **Unified Navigation & Terminology**: Renamed all occurrences of "音乐" (Music) to "音廊" (Music Gallery), "播放队列" to "播放列表", and streamlined button labels to concise 2-6 Chinese characters.
- **Typography Standardization**: Cleaned micro text (`text-[10px]`, `scale-90`) across admin layout, dashboard, and ops diagnostic tables to legible `text-xs sm:text-sm` (13px/14px).

---

## [v1.0.4] - 2026-11-05

### Added
- **Dense DataGrid for Article Management**: Overhauled article queue table into a high-density single-screen grid with 44×44 cover preview thumbnails, hover edit overlay, and React Portal lightbox zoom.
- **In-Place Cover Replacement**: Integrated cover change dialog supporting direct external image URLs or one-click local uploads via R2 storage bucket API (`POST /api/feed/cover/:id`).
- **Pin / Sticky Article Management**: Integrated data model `top` field; pinned articles permanently rank first with an amber glow `📌 置顶` badge and in-place toggle button (`ri-pushpin-2-fill`).
- **Standard Pagination Controls**: Complete footer pagination bar featuring total count (`共 X 条`), page size dropdown (10/20/50 per page, default 20), dynamic page numbers with ellipsis (`...`), and quick jump input (`前往 [ ] 页`).
- **Queue Task Cancellation Control**: Added cancel button for pending and processing tasks (`POST /api/config/queue-status/:id/cancel`) to immediately reset state to idle and release queue blocks.
- **Card-to-Tab Bidirectional Sync**: Top metric cards (Pending, Running, Done, Failed) are fully bidirectional-synced with bottom category tabs; added `[List]` dialog drawer for instant task inspection.

### Changed
- **Typography & Visual Contrast**: Increased article title font size to 15px (`text-[15px] font-medium`) and last-updated timestamp to 13px (`text-[13px] font-mono text-neutral-600 dark:text-neutral-300`) for enhanced readability.
- **Relocated Columns**: Moved the "Last Updated" column directly after the "Article Title" column for streamlined browsing.

### Fixed
- **Cleaned Extraneous Numbers**: Removed unwanted `0 ` prefixes and rogue red `1` badge by enforcing strict boolean JSX conditionals and clean title trimming.

---

## [v1.0.3] - 2026-11-04

### Added
- **Friends Gallery SPA Redesign**: Replaced the bulky static submission form with an elegant `[+ Recommend Site / Apply Link]` modal dialog adhering to the soft pink-white theme (`#ff4d79`).
- **URL Metadata AI Inspection**: Built `/api/friend/inspect` pipeline to sniff HTML `<title>`, `<meta description>`, and icons under 4-second timeout protection, enhanced by Worker AI for 40-word summaries and automatic tag classification.
- **Guest Application Workflow**: Added public `/api/friend/apply` endpoint allowing visitor submissions with pending status (`accepted = 0`) and webhook alerts.
- **Robust Favicon Fallback**: Upgraded favicon resolution with Google Favicon API fallback and pink initial letter badge on image load error.

---

## [v1.0.2] - 2026-11-03

### Added
- **Multi-language Syntax Highlighting**: One Dark & One Light theme with Prism engine; supports 30+ languages with line numbers and one-click copy in Mac traffic light terminal containers.
- **Poster Danmaku Stream**: Video-style floating text danmaku with tri-zone spatial isolation, leaving the center artwork completely clear, with hover-to-pause reading support.
- **Dedicated SEO Engine Navigation (`/admin/seo`)**: Integrated Google, Bing, and Baidu webmaster links, automatic Sitemap/Robots/IndexNow checks, and Cloudflare Crawler Hints guidelines.
- **Multi-Version AI Prompt Workshop**: Dense DataGrid in `/admin/ai` supporting multiple prompt versions with dynamic creation, in-place editing, and custom selection.
- **Comment Spam Security Gateway**: Automatically flags comments containing URLs as pending (`approved = 0`) with in-place admin approval tools.

### Fixed
- **Timezone Month Offset**: Fixed SQLite timezone issue where November moments were swallowed into October.
- **Dropdown Clipping**: Elevated frosted dropdown menus to `z-[999]` with overflow-visible card containers to prevent clipping.

---

## [v1.0.1] - 2026-11-02

### Added
- **Dense DataGrid for Sticky Notes**: Replaced bulky accordion cards with a unified dense table for full control over styles, links, emojis, and covers.
- **Draggable Homepage Notes**: Admin drag-and-drop handles for reordering notes on the homepage gallery with localStorage persistence.
- **All-Notes Widget Styles**: Completed circle and capsule widget variants for Timeline, Moments, Friends, and Search notes.

---

## [v1.0.0] - 2026-11-01

### Added
- **Front-end Extreme Code Splitting**: Reduced entry chunk size from 5.68 MB to 131.42 kB (97.7% reduction, 38 kB gzip).
- **Decoupled Heavy Dependencies**: Monaco Editor (3.88MB) and Mermaid/Cytoscape (3.07MB) are now 100% on-demand dynamically loaded.
- **12 Artistic Title Typographies**: 4×3 symmetrical layout covering arcade pixel, anime candy, gothic metal, vaporwave, and cosmic starlight.
- **Mini Sidebar**: Compact 68px icon rail with hover expansion to 256px and pushpin state persistence.
- **Polaroid Sticky Notes Wall**: Gallery homepage featuring polaroid paper textures and organic tilts (`rotate-[-1.8°]`).
- **Comprehensive Test Suite**: 54 suites, 484 unit/integration tests passing (100% green).
[v1.0.4]: https://github.com/Smail-droid/Rin/releases/tag/v1.0.4
