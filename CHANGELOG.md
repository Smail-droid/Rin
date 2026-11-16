# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.0.7] - 2026-11-15

### Added
- **MHub & Navidrome Persistent Bottom Player Dock (`BottomPlayerDock`)**: Built a persistent bottom music player dock inspired by MHub (`jizizr/mhub`) and Navidrome, featuring left-aligned artwork with live animated audio waves, center transport controls with precision time scrubber (`00:00 / 03:48`), volume slider, and instant lyrics/queue popovers.
- **Navidrome Live Audio Visualizer Waves**: Added a jumping 3-bar audio visualizer animation on playing album cards in the gallery view.
- **Live Database Sync & Complete Layout Controls in Aesthetic Studio**: Synced site title and bio reactively with Cloudflare D1 database values (eliminating fallback defaults), and integrated full gallery padding (0px to 80px), layout alignment (Center/Fluid), and header layout styles (Classic/Compact).
- **In-Situ AI Configuration Inside Assistant Drawer (`WritingAICopilotDrawer`)**: Embedded an on-the-fly AI provider, model, API key, and reverse-proxy URL settings panel right inside the assistant drawer with one-click connectivity testing and direct persistence, completely removing the need to visit `/admin/settings` to configure AI.
- **Full In-Situ Aesthetic Studio Repatriation**: Expanded `InSituAestheticStudio` with live site name & description editing, font family selector (Sans, Serif, Mono), and header layout styles (Float, Top, Bottom).
- **Deep DataGrid In-Place Actions & Dual Pagination**: Overhauled `/admin/dashboard` into a true interactive DataGrid: clickable header column sorting (Time Newest/Oldest, ID, Title A-Z), in-place one-click status flipping between Public and Draft, interactive AI summary badge with one-click re-generation, in-place title quick rename, and dual top & bottom pagination controls.
- **Slide-Over Permission Drawer & Lock Filter Tab**: Upgraded dashboard article permissions from a center dialog to an elegant right-side slide-over drawer; added a dedicated `🔒 已加锁` filter tab and interactive `访问权限` column badge in the data table.
- **Music Preview Decoupling (`playTemporaryTrack`)**: Previews in explore view now only stream audio for temporary listening, strictly prohibiting unwanted R2 uploads or permanent playlist insertion.
- **Auto-Persist R2 Immediate Memory**: "收录时自动转存音廊" setting now persists immediately to localStorage on toggle without requiring manual config save.
- **Integrated Admin Music Header**: Merged status card and tab switcher into a single dense row, eliminating large horizontal and vertical whitespace voids.
- **Relocated Music Refresh Button**: Moved refresh button down into the list/grid toolbar right next to search and filters.
- **Grid View In-Place Song Rename**: Fixed non-responsive edit button in album grid view by rendering inline edit input upon click.
- **Smart Missing Cover Autofetch**: Displays missing cover count dynamically and 100% skips tracks that already have covers.
- **Playlist Up/Down Reordering**: Added micro up/down reorder buttons to playlist rows for easy manual sorting.
- **Tags Icon Correction (`admin-tags.tsx`)**: Replaced inappropriate green play icon with clean price tag icon.
- **Dashboard Article Lock Badges & Integration**: Added password/token lock status badges in dashboard table rows and integrated direct password management into the quick-edit modal.
- **In-Situ Aesthetic Studio (`InSituAestheticStudio`)**: Added on-the-fly front-of-house styling drawer mounted via `React.lazy` and `profile` gate (0 visitor bundle overhead). Enables instant live switching between 4 card layout variants, 8 curated atmospheric theme presets, waterfall columns (auto/2/3/4), spacing gaps (16/24/32px), card opacity steps, and day/night mode.
- **Dark-Mode Contrast Guard (`applyThemeColor`)**: Added luminance detection to prevent black-on-black UI when selecting dark accents (e.g. Paper Ink `#27272a`) in dark mode, dynamically compensating to high-contrast silver white (`#e4e4e7`).
- **Wired 4 Layout Variants to Homepage Feed Waterfall (`feeds.tsx`)**: Connected `siteConfig.feedCardVariant` directly into `feeds.tsx`, enabling real-time live morphing between Compact, Poster, Editorial, and Polaroid variants on the home stream.
- **Reactive Configuration Synchronization**: Added `rin:config-updated` window event pipeline across `useAppBootstrap` and client components to ensure multi-device config reactivity without full page reload.

### Changed
- **Replaced 4 Fake Card Variants with Bone-Deep Structural Layouts**: Completely redesigned `client/src/components/feed_card.tsx` so each variant has a distinct DOM structure:
  - `compact`: Single dense datarow displaying date, title, tags, and reading time for fast scanning.
  - `poster`: Full-bleed 3:4 aspect-ratio hero photo with title and summary overlaid on frosted glass gradient.
  - `editorial`: Text-first layout featuring prominent serif headline, generous summary line-height, and right-aligned thumbnail.
  - `default`: Polaroid photo card with classic white border, top-pinned photo, and organic hover warmth.
- **Refined Typography System**: Replaced 12 tacky WordArt `.art-title-*` styles (gradients and text-shadows) with clean, high-contrast modern typography adhering to font family and kerning rules.
- **Pure Micro-Blogging for Moments**: Removed mandatory blockquote status prefix (`> **状态：...**\n\n`) from `moments.tsx`, replacing it with optional mood tags and free-form Markdown.
- **Purified Settings Header & Navigation**: Removed fake status capsules (`Worker 边缘就绪`, `R2 存储桶已连接`) and verbose corporate blurbs from `settings.tsx`; removed `/admin/ops` and ghost `/friends` jump entry from primary sidebar navigation (`admin-layout.tsx`).
- **Streamlined Friends Refresh Button**: Replaced long verbose text button in `friends.tsx` with a clean 36×36 square icon button.
- **Consistent Tag Badges**: Restored uniform `🏷️` icon across all homepage tag pills, removing arbitrary book emoji replacements.

### Removed
- **Excised Redundant Theme and Atelier Tabs in Backend Settings**: Completely excised the duplicate "主题与布局" (Tab 2) and "进阶设置" (Tab 3) from `/admin/settings`, reducing the settings console to purely General & Services, ensuring visual presentation is exclusively governed in-situ by the front-of-house Aesthetic Studio.
- **Removed Redundant 15-Item Shortcut Card Grid in Dashboard**: Completely removed the clumsy 15-card shortcut matrix (`快捷功能调度`) in `/admin/dashboard`, eliminating redundant URL links and promoting the Article Management Dense DataGrid to the top of the viewport.
- **Physical Removal of JeikCode Copilot**: Completely deleted `client/src/components/jeikcode-copilot.tsx` (834 lines) and unmounted from `App.tsx`, eliminating hardcoded LAN IP, token leak risk, and floating widget, instantly cutting 24.5 kB from the entry chunk.
- **Severed External Proxy Scrapers in Friends**: Removed brittle 3rd-party CORS proxy chains (`corsproxy.io`, `microlink.io`, FileReader base64) from `friends.tsx`, standardizing on native URL fields and Cloudflare Worker edge inspection.

### Fixed
- **AI Summary Pipeline Scoping & Region Error Diagnostics**: Explicitly scoped dashboard AI summary calls to the `summary` stage (preventing unnecessary tech/format pipeline passes), caught pipeline exceptions with `processAIError`, and provided actionable resolution instructions when Google Gemini returns 400 region restrictions (`User location is not supported`).

---

### Added
- **AI Description Refinement in Edit Modal**: Added "☆ AI 智能精炼" button to `EditFriendModal`, aligned with the add-link modal for quick one-click synthesis.
- **Upgraded AI Refinement System Prompt**: Restructured prompt guidelines to generate concise, professional 8-24 character descriptions without conversational fluff or extraneous punctuation.
- **Full NodeSeek Badge Row in Polaroid View**: Restored missing UID link, Diamond Rank Lv badge, chicken leg count, and registration days badge in polaroid notes.
- **SVG Image Recognition (`isValidImageBuffer`)**: Added SVG XML recognition in image buffering to safely store NodeSeek vector avatars into R2 as `.svg` assets.
- **Historic Corrupted Avatar Auto-Unwrap (`sanitizeAvatarUrl`)**: Automatically strips defunct `images.weserv.nl` wrappers across views, modals, and updates, reverting to native official avatars.

### Changed
- **Preserved User-Customized Descriptions**: Protected custom site descriptions and titles from being overwritten during batch or single NodeSeek asset updates.
- **Polaroid Photo Viewport Tightening**: Replaced large `aspect-video` container with compact `h-28 sm:h-32` frame and tightened grid gaps to `gap-4 sm:gap-5`, cutting empty white space by 35%.
- **Sub-3.5s Sniffing & Update Timeouts**: Trimmed frontend and backend proxy cascade timeouts to strictly under 3.5 seconds for instant feedback.

### Fixed
- **403 Forbidden on Weserv Proxy**: Completely removed defunct `images.weserv.nl` references blocked by NodeSeek's anti-hotlinking protections.

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
