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
      ApiKeyInput.tsx    # API key entry form
      ImageUpload.tsx    # Drag-drop or click to upload
      ClarifyScreen.tsx  # Section selection UI
      GroceryList.tsx    # Final checklist by Kroger section
      ImageThumbnail.tsx # Clickable thumbnail with modal
    lib/
      anthropic-client.ts # Direct browser calls to Anthropic API
      store-sections.ts   # STORE_SECTIONS mapping + categorizeItem()
      types.ts            # TypeScript interfaces
      schemas.ts          # Zod schemas for AI output
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
