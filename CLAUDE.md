# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smart Grocery List Organizer - a web app that uses Claude AI to read handwritten grocery lists from photos. Now includes a clarification step to identify different sections (store-specific lists, meal plans, crossed-out items) and lets users choose what to include.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **AI:** Vercel AI SDK with Anthropic provider
- **Styling:** Tailwind CSS
- **Validation:** Zod for structured outputs
- **Language:** TypeScript

## Project Structure

```
kroger-list/
  app/
    page.tsx           # Main app (upload, clarify, list screens)
    api/
      analyze/
        route.ts       # POST - analyze image, return sections
    layout.tsx         # Root layout with Tailwind
    globals.css        # Tailwind imports
  components/
    ApiKeyInput.tsx    # API key entry form
    ImageUpload.tsx    # Drag-drop or click to upload
    ClarifyScreen.tsx  # Section selection UI
    GroceryList.tsx    # Final checklist by Kroger section
  lib/
    store-sections.ts  # STORE_SECTIONS mapping + categorizeItem()
    types.ts           # TypeScript interfaces
    schemas.ts         # Zod schemas for AI output
```

## Running the App

```bash
npm install
npm run dev
```

Server runs at http://localhost:3000.

## Architecture

1. User enters Anthropic API key (stored in localStorage)
2. User uploads photo of handwritten grocery list
3. Frontend sends image to `/api/analyze` endpoint
4. Vercel AI SDK calls Claude with Zod schema for structured output
5. Claude identifies sections (grocery, meal_plan, crossed_out, notes)
6. User selects which sections to include (clarify screen)
7. Selected items are categorized by Kroger store section
8. Items displayed as checklist organized by section

## Key Code Locations

- `lib/store-sections.ts` - STORE_SECTIONS mapping + categorizeItem()
- `lib/schemas.ts` - Zod schema for Claude's structured output
- `lib/types.ts` - TypeScript interfaces
- `app/api/analyze/route.ts` - Image analysis endpoint
- `app/page.tsx` - Main state machine (api_key -> upload -> clarify -> list)

## Adding Store Sections

Edit the `STORE_SECTIONS` object in `lib/store-sections.ts` to add new section keywords.
