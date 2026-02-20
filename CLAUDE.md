# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smart Grocery List Organizer - a web app that uses Claude AI to read handwritten grocery lists from photos. Includes a clarification step to identify different sections (store-specific lists, meal plans, crossed-out items) and lets users choose what to include.

## Tech Stack

- **Framework:** Vite + React
- **AI:** Anthropic SDK (direct browser calls)
- **Styling:** Tailwind CSS v4
- **Validation:** Zod for structured outputs
- **Language:** TypeScript

## Project Structure

```
kroger-list/
  index.html           # Entry point with meta tags and font links
  vite.config.ts       # Vite configuration
  src/
    main.tsx           # React mount point
    App.tsx            # Main app (upload, clarify, list screens)
    index.css          # Tailwind imports + theme
    components/
      AnimatedTitle.tsx  # Rough-notation animated title
      ApiKeyInput.tsx    # API key entry form
      ClarifyScreen.tsx  # Section selection UI
      DarkModeToggle.tsx # Theme toggle button
      GroceryList.tsx    # Final checklist by Kroger section
      HistoryPanel.tsx   # Slide-out panel for past lists
      ImageThumbnail.tsx # Clickable thumbnail with modal
      ImageUpload.tsx    # Drag-drop or click to upload
      OfflineBanner.tsx  # PWA offline indicator
      SwipeableItem.tsx  # Swipe-to-delete list item
    hooks/
      useDarkMode.ts     # Dark mode state + localStorage sync
      useOnlineStatus.ts # Network connectivity hook
    lib/
      anthropic-client.ts # Direct browser calls to Anthropic API
      schemas.ts          # Zod schemas for AI output
      storage.ts          # Session management, image compression, localStorage
      store-sections.ts   # STORE_SECTIONS mapping + categorizeItem()
      types.ts            # TypeScript interfaces (GroceryItem, ListSession, etc.)
  public/               # Static assets
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

SwiftUI migration of the web app. Lives in `AIsleList/` directory.

- **Build system**: Uses xcodegen (`project.yml`) to generate `AIsleList.xcodeproj`. Run `cd AIsleList && xcodegen generate` after adding/removing Swift files.
- **Data**: SwiftData with `ListSession` and `GroceryItem` @Model classes. ModelContainer created explicitly in `AIsleListApp.swift`.
- **Services**: Protocol abstraction layer (`GroceryAnalysisService`) with `DirectAnthropicService` (BYOK) implementation. Designed for swapping to Supabase in Phase 2.
- **Navigation**: Enum-based `Route` with `@Observable AppViewModel` state machine (mirrors React's App.tsx flow).
- **Plans/research**: `thoughts/prds/swiftui-migration-plan.md` has the full implementation plan. `thoughts/swiftui-architecture-research.md` has patterns and code examples.
- **Agent notes**: `thoughts/agent-notes/` has structured notes for agent context (project overview, iOS structure, migration status, gotchas, next steps). These docs are kept up-to-date automatically in the background -- read them for current project state before starting work.

## Gotchas

- **SwiftData + CloudKit**: Do NOT add CloudKit entitlements until the CloudKit container is actually created in Apple Developer portal. Unconfigured CloudKit entitlements cause SwiftData to silently discard all writes -- inserts and saves appear to succeed but data is never persisted.
- **SwiftData persistence**: Use explicit `ModelContainer` init with `fatalError` on failure instead of the `.modelContainer(for:)` convenience modifier, which hides initialization errors.
- **Swift abs() overflow**: Never use `abs()` on hash values or any `Int` that could be `Int.min` -- it causes a fatal overflow. Use `.magnitude` instead (returns `UInt`, safe for all values).
- **Tailwind v4**: Uses CSS-based config in `src/index.css`, not `tailwind.config.js`
- **Browser API calls**: Uses `dangerouslyAllowBrowser: true` intentionally - API key is user-provided and stored in localStorage
- **PWA**: Configured via `vite-plugin-pwa` in `vite.config.ts` - service worker auto-generated on build
- **Dark mode**: Uses Tailwind's `dark:` variant with class strategy; state persisted to localStorage
- **List history storage**: Uses separate localStorage keys for efficiency:
  - `grocery_sessions_index` - Lightweight index of all sessions
  - `grocery_session_{id}` - Full session data (items only)
  - `grocery_session_image_{id}` - Compressed thumbnail (~200KB max)
- **Image compression**: Images are resized to 400px width and JPEG compressed before storage to allow 20+ lists in localStorage
