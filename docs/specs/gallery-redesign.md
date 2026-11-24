# Gallery Redesign, Composable Theming & Studio Workbench Spec

## Problem Statement

Visitors and the site owner currently experience a fragmented, cluttered UI across the gallery blog:
1. A persistent multi-row toolbar (`TopAtelierRibbon`) stacks below the main navigation bar across every route, mixing visitor ambience switches, homepage-only view toggles, duplicate navigation/volume controls, and admin-only actions into 2–3 rows.
2. Primary pages (`/` home, `/timeline`, `/moments`, `/hashtags`, `/friends`) have inconsistent page headers, rigid default black sans-serif headings, and misaligned container widths (wide page header above a narrowed list container).
3. Theme and typography controls include shell presets with no perceptible difference (`art-title-*` flattened rules, hidden 3rd header layout, single-accent palettes without coordinated canvas/surface/ink/hairline tokens, bright plastic rose highlights against pure white), and `/admin/settings` renders monotonous full-width single-row strips instead of modular Bento Grid controls.
4. Normal saves/copies block the user with confirmation alert modals (`showAlert`) instead of non-blocking inline button states (`✓ 已保存`) or subtle toasts.
5. Friend descriptions are artificially truncated to 40 characters (`maxLength={40}` / `.slice(0, 40)`), friend cards render large empty grey boxes around small favicons, `/hashtags` scatters controls across 5 disconnected zones, and `/music` / `/gallery` lack cohesive Navidrome/Bento media library ergonomics.
6. The dedicated `/admin/ai` hub was dropped from the admin sidebar navigation, `WritingAICopilotDrawer` reads/writes mismatched `ai_*` config keys instead of `ai_summary.*`, prompt presets live only in browser `localStorage`, and backend model fetching/chat requests fail on Anthropic Claude and Google Gemini endpoints.

## Solution

Restructure the entire frontend shell, composable design token system, page workbenches, and AI configuration pipeline into cohesive, non-blocking, visually restrained gallery experiences inspired by **DesignSpells** (warm paper canvas, serif editorial titles, quiet card framing), **BentoGrids** (modular visual control blocks), and **Refero** (calm left navigation rail + generous centered workspace).

## User Stories

1. As a visitor, I want a clean single-row Gallery Top Bar across all pages with no stacked debugging-style toolbars, so that artwork and writing occupy center stage immediately.
2. As a visitor, I want a lightweight top-right Appearance Popover (`🎨`) to toggle ambience particles (`Off / Sakura / Rain / Fireflies`), switch coordinated Theme Presets, and adjust reading font family/size, without leaving the page or seeing admin tools.
3. As an admin, I want my quick studio shortcuts (`撰写`, `云端图床`, `微光音廊`, `标签管理`, `AI 助手`, `系统设置`, `后台概览`) tucked cleanly inside my Avatar menu and the Admin Sidebar, with zero extra intermediate drawers that bounce me back to admin pages.
4. As a reader, I want every primary page (`/`, `/timeline`, `/moments`, `/hashtags`, `/friends`) to share an aligned `PageHeader` with an uppercase English eyebrow, humanistic serif/Kai title, calm ink subtitle, and page-local actions (like homepage layout/AI summary/list filter controls) strictly aligned with the content column below.
5. As an admin customizing appearance, I want composable design tokens (`Canvas`, `Surface`, `Elevated`, `Ink`, `Hairline`, `Accent`) with a calm warm-paper Morandi sakura default (`#FDFBFC` + `#D87A90` + `#2D2628`) alongside vibrant and cool presets, plus an orthogonal `Title Font × Title Effect` system and 3 distinct header layouts (`classic`, `compact`, `dock`) where every preset produces an unmistakable visual change.
6. As an admin using `/admin/settings`, I want Bento Grid modular visual cards with thumbnails and non-blocking inline save states (`保存中…` → `✓ 已保存`) instead of monotonous single-row setting bars and modal alert popups on success.
7. As a user performing any normal save, copy, or quick edit across the app, I want inline button feedback or a non-blocking toast, reserving modal alert dialogs strictly for errors and destructive confirmations (`showConfirm`).
8. As a reader of `/friends`, I want full friend descriptions (up to 160+ characters, expandable) and clean 3-column horizontal namecards (with optional diffused-gradient gallery cards and compact rows) with no empty grey header boxes.
9. As a visitor or admin on `/hashtags`, I want a single clean toolbar above the tag cloud/table, calm hairline tag chips by default, and bottom-anchored pagination controls.
10. As a listener or admin on `/music` and `/gallery`, I want a Refero-style quiet left rail, Navidrome-style Album Wall grid + Track Table view (with strict visitor read-only enforcement), and clean Bento/masonry cloud photo browsing.
11. As an admin configuring AI, I want `AI 助手` visible in the Admin Sidebar (`/admin/ai`), unified `ai_summary.*` keys across Settings and the Writing Copilot Drawer, server-persisted prompt presets, and reliable model listing + generation across OpenAI, Claude, Gemini, DeepSeek, Zhipu, and Cloudflare Workers AI (including automatic reuse of already-saved masked API keys).

## Implementation Decisions

- **Testing Seams**:
  1. `Header` + `AppearancePopover` + `UserAvatar` seam: verifies single-row rendering, visitor vs admin menu isolation, and live updates to `theme.ambience`, `theme.preset`, `theme.font_family`, `theme.font_size` via DOM attributes/CSS custom properties.
  2. `PageHeader` + Primary Page Alignment seam: verifies eyebrow, title font/effect classes, subtitle, and page-scoped `actions` slot across `/`, `/timeline`, `/moments`, `/hashtags`, `/friends`.
  3. `theme-color` Semantic Token seam: verifies `applyThemeColor` / `applyThemePalette` / `applyThemeTitleStyle` write coordinated `--rin-canvas-rgb`, `--rin-surface-rgb`, `--rin-elevated-rgb`, `--rin-ink-rgb`, `--rin-ink-muted-rgb`, `--rin-hairline-rgb`, and `--theme-rgb` across light and dark modes with WCAG AA contrast protection.
  4. `Non-blocking Feedback` seam: verifies `Settings`, `AdminAIPage`, `AISummarySettings`, `AdminDashboardPage`, `FriendsPage`, `HashtagsPage`, and `WritingPage` update button/inline status on success and invoke `showAlert` only on error conditions.
  5. `AI Multi-Protocol & Prompt Persistence` seam: tests `server/src/utils/ai.ts` (`fetchExternalAIModels`, `executeExternalAI`, `testAIModel`) and `server/src/services/config.ts` (`ai_summary.prompt_presets`, stored-key fallback on `/test-ai` and `/ai/models`) against Anthropic Claude, Google Gemini (`/v1beta/openai`), OpenAI-compatible endpoints, and Workers AI.
  6. `Media Workbench & Friends/Hashtags` seam: tests Navidrome Album grouping & visitor read-only locking on `/music`, extended friend description parsing/serialization (>40 chars), and single-toolbar `/hashtags` filtering & pagination footer.
- **No-Op & Hardcoding Elimination**:
  - Replace flattened `.art-title-*` rules with orthogonal `theme.title_font` (`sans | serif | kai | mono`) × `theme.title_effect` (`clean | soft_glow | editorial_rule | tactile_ink | neon_prism`).
  - Load Chinese humanistic fonts (`Noto Serif SC` & `LXGW WenKai` subsets via non-blocking async stylesheet / `font-display: swap`) with crisp system fallback stacks.
  - Keep `WritingAICopilotDrawer` directly aligned with `ai_summary.*` keys instead of legacy `ai_*` keys.

## Out of Scope

- Migrating backend database engine away from Cloudflare D1 / Drizzle ORM.
- Rewriting Markdown AST parsing or replacing `@monaco-editor/react` / `mermaid` / `react-syntax-highlighter` lazy-loading architecture.
- Introducing any external UI component library or changing authentication provider flows.
