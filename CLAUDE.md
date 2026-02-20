# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AIsle List** -- a smart grocery list app that uses Claude AI to read handwritten grocery lists from photos. Includes a clarification step to identify different sections (store-specific lists, meal plans, crossed-out items) and lets users choose what to include. Has a web app (original), native iOS app (in progress), and Supabase backend for auth + API proxying.

## Tech Stack

- **Web:** Vite + React + TypeScript, Tailwind CSS v4, Zod, Anthropic SDK (BYOK)
- **iOS:** SwiftUI, SwiftData, Supabase Swift SDK (on `feature/swiftui-migration` branch)
- **Backend:** Supabase (Postgres + Edge Functions on Deno), Sign in with Apple

## Project Structure

```
kroger-list/
  src/                   # Web app (Vite + React)
    main.tsx             # React mount point
    App.tsx              # Main app (upload, clarify, list screens)
    index.css            # Tailwind imports + theme
    components/          # UI components (upload, clarify, list, history, etc.)
    hooks/               # useDarkMode, useOnlineStatus
    lib/                 # anthropic-client, schemas, storage, store-sections, types
  AIsleList/             # iOS app (SwiftUI) -- see agent-notes for full structure
    Models/              # SwiftData models
    Views/               # SwiftUI views (Auth, Upload, Clarify, List, History, Settings)
    Services/            # Protocol-based services (analysis, auth) + implementations
    Utilities/           # StoreSections, ImagePreprocessor, KeychainHelper
    project.yml          # xcodegen config (source of truth for .xcodeproj)
  supabase/              # Supabase backend
    migrations/          # 001_initial.sql: scan_usage, subscriptions tables (RLS)
    functions/           # analyze-grocery-list edge function (Deno, Anthropic proxy)
    config.toml          # Local dev config
  public/                # Static web assets
```

## Running the App

```bash
npm install
npm run dev
```

Dev server runs at http://localhost:5173.

Build for production:
```bash
npm run build    # outputs to dist/
npm run preview  # preview production build
npm run lint     # run ESLint
```

## Architecture

1. User enters Anthropic API key (stored in localStorage)
2. User uploads photo of handwritten grocery list
3. Browser sends image directly to Anthropic API (dangerouslyAllowBrowser)
4. Claude identifies sections (grocery, meal_plan, crossed_out, notes)
5. User selects which sections to include (clarify screen)
6. Selected items are categorized by Kroger store section
7. List is auto-saved as a session (with compressed thumbnail)
8. Items displayed as checklist organized by section
9. Users can access past lists via history panel

## Key Code Locations

- `src/App.tsx` - Main state machine (api_key -> upload -> clarify -> list)
- `src/lib/anthropic-client.ts` - Anthropic API integration
- `src/lib/storage.ts` - Session CRUD, image compression, localStorage management
- `src/lib/store-sections.ts` - STORE_SECTIONS mapping + categorizeItem()
- `src/lib/types.ts` - TypeScript interfaces (GroceryItem, ListSession, SessionIndexEntry)

## Adding Store Sections

Edit the `STORE_SECTIONS` object in `src/lib/store-sections.ts` to add new section keywords.

## iOS App (AIsleList/)

SwiftUI migration of the web app. Lives in `AIsleList/` directory. Uses xcodegen (`project.yml`) to generate the Xcode project -- run `cd AIsleList && xcodegen generate` after adding/removing Swift files. Supports dual-mode: Supabase auth (Sign in with Apple + edge function) or BYOK fallback (direct Anthropic API calls). Mode is determined by presence of `SUPABASE_URL` in Info.plist.

## Supabase Backend (supabase/)

Edge function proxies Anthropic API calls with JWT auth and scan limits (3 free/month). Database schema has `scan_usage` and `subscriptions` tables with row-level security. See `thoughts/agent-notes/gotchas-and-lessons.md` for edge function architecture details.

## Agent Notes

`thoughts/agent-notes/` has structured notes kept up-to-date automatically in the background. Read them for current project state before starting work. Covers: project overview, iOS app structure, migration status, gotchas/lessons learned, and next steps.

## Gotchas

- **Tailwind v4**: Uses CSS-based config in `src/index.css`, not `tailwind.config.js`
- **Browser API calls**: Uses `dangerouslyAllowBrowser: true` intentionally -- API key is user-provided and stored in localStorage
- See `thoughts/agent-notes/gotchas-and-lessons.md` for iOS/SwiftData gotchas
