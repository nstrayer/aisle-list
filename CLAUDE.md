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
      storage.ts          # localStorage utilities
      store-sections.ts   # STORE_SECTIONS mapping + categorizeItem()
      types.ts            # TypeScript interfaces
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
7. Items displayed as checklist organized by section

## Key Code Locations

- `src/App.tsx` - Main state machine (api_key -> upload -> clarify -> list)
- `src/lib/anthropic-client.ts` - Anthropic API integration
- `src/lib/store-sections.ts` - STORE_SECTIONS mapping + categorizeItem()
- `src/lib/types.ts` - TypeScript interfaces

## Adding Store Sections

Edit the `STORE_SECTIONS` object in `src/lib/store-sections.ts` to add new section keywords.

## Gotchas

- **Tailwind v4**: Uses CSS-based config in `src/index.css`, not `tailwind.config.js`
- **Browser API calls**: Uses `dangerouslyAllowBrowser: true` intentionally - API key is user-provided and stored in localStorage
- **PWA**: Configured via `vite-plugin-pwa` in `vite.config.ts` - service worker auto-generated on build
- **Dark mode**: Uses Tailwind's `dark:` variant with class strategy; state persisted to localStorage
