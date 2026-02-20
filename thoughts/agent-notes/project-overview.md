# Project Overview

## What This Is

**AIsle List** -- a smart grocery list app that uses Claude AI to read handwritten grocery lists from photos and organize items by Kroger store sections.

## Dual Codebase

The project has two codebases:

1. **Web app** (original) -- Vite + React + TypeScript in `src/`. Uses Anthropic SDK with user-provided API key (BYOK). Tailwind CSS v4, Zod for structured outputs, PWA via vite-plugin-pwa.
2. **iOS app** (in progress) -- Native SwiftUI in `AIsleList/`. Full rewrite, not a wrapper. Currently on `feature/swiftui-migration` branch.

The React web app is functionally complete and serves as the reference implementation for the iOS port.

## Core User Flow

1. User provides API key (web: localStorage, iOS: Keychain)
2. User uploads/photographs a handwritten grocery list
3. Image sent to Claude API (Sonnet for analysis)
4. Claude identifies sections: grocery, meal_plan, crossed_out, notes
5. User selects which sections to include (clarify screen)
6. Selected items are categorized by Kroger store section via keyword matching
7. Haiku runs a sanity check on category assignments
8. Items displayed as checklist organized by store section
9. Sessions auto-saved for history

## Key Design Decisions

- **BYOK (Phase 1)**: User provides their own Anthropic API key. Phase 2 will replace this with Supabase auth + server-side API proxy.
- **SwiftData for persistence**: Replaces localStorage. Models: `ListSession`, `GroceryItem`.
- **Service protocol abstraction**: `GroceryAnalysisService` protocol allows swapping `DirectAnthropicService` (BYOK) for `SupabaseAnalysisService` (Phase 2) without UI changes.
- **xcodegen for project management**: `project.yml` generates `AIsleList.xcodeproj`. Run `cd AIsleList && xcodegen generate` after adding/removing Swift files.

## Agent Notes Discovery

CLAUDE.md has a top-level "Agent Notes" section directing agents to read `thoughts/agent-notes/` for current project state before starting work. CLAUDE.md is intentionally slim -- it covers project structure, build commands, and key code locations, then defers to agent notes for iOS details and gotchas (e.g., `gotchas-and-lessons.md` for iOS/SwiftData gotchas, web app storage architecture, etc.).

## Repository Links

- Implementation plan: `thoughts/prds/swiftui-migration-plan.md`
- AI categorization PRD: `thoughts/prds/ai-categorization.md`
- Architecture research: `thoughts/swiftui-architecture-research.md`
- Component mapping: `thoughts/swiftui-component-mapping.md`
- StoreKit research: `thoughts/storekit2-research.md`
- Subscription research: `thoughts/subscription-research.md`, `thoughts/subscription-and-ios-research.md`
- iOS conversion rationale: `thoughts/ios-conversion-research.md`
- Web app enhancement ideas: `ENHANCEMENT_RESEARCH.md` (root)
- Web app pending TODOs: `TODO.md` (root) -- drag-drop categories, styling, animations
