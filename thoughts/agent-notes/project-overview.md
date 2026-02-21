# Project Overview

## What This Is

**AIsle List** -- a smart grocery list app that uses Claude AI to read handwritten grocery lists from photos and organize items by Kroger store sections.

## Three Codebases

The project has three codebases:

1. **Web app** (original) -- Vite + React + TypeScript in `src/`. Uses Anthropic SDK with user-provided API key (BYOK). Tailwind CSS v4, Zod for structured outputs, PWA via vite-plugin-pwa.
2. **iOS app** (Phase 1 complete, Phase 2 in progress) -- Native SwiftUI in `AIsleList/`. Full rewrite, not a wrapper. Currently on `feature/swiftui-migration` branch. Phase 1 (core SwiftUI app with BYOK) is complete; Phase 2 (Supabase backend + auth) code is written, pending manual Supabase project setup.
3. **Supabase backend** -- `supabase/` directory. Postgres database (scan_usage, subscriptions tables with RLS), Deno edge function (`functions/analyze-grocery-list/index.ts`) that proxies Anthropic API calls with JWT auth and scan limits. Config in `config.toml`.

The React web app is functionally complete and serves as the reference implementation for the iOS port.

## Core User Flow

**Auth mode (Supabase -- iOS Phase 2):**
1. User signs in with Apple (Supabase auth)
2. User uploads/photographs a handwritten grocery list
3. Image sent to Supabase edge function, which proxies to Claude API (Sonnet for analysis)
4. Claude identifies sections: grocery, meal_plan, crossed_out, notes
5. User selects which sections to include (clarify screen)
6. Selected items are categorized by Kroger store section via keyword matching
7. Edge function calls Haiku for sanity check on category assignments
8. Items displayed as checklist organized by store section
9. Sessions auto-saved for history
10. Free tier: 3 scans/month; paid subscribers: unlimited

**BYOK mode (web app + iOS fallback):**
1. User provides API key (web: localStorage, iOS: Keychain)
2-9. Same flow, but API calls go directly from the client to Anthropic

## Key Design Decisions

- **Dual-mode architecture**: iOS app supports both Supabase auth mode and BYOK fallback. Mode is determined at launch by checking for `SUPABASE_URL`/`SUPABASE_ANON_KEY` in Info.plist. If missing, BYOK mode activates automatically.
- **Supabase backend (Phase 2)**: Edge function (`supabase/functions/analyze-grocery-list/`) proxies Anthropic API calls. Handles JWT auth, subscription checking, and free-tier scan limits (3/month). Database has `scan_usage` and `subscriptions` tables with RLS.
- **Sign in with Apple**: Primary auth method. Uses Supabase's `signInWithIdToken` with Apple ID credential + SHA256-hashed nonce.
- **SwiftData for persistence**: Replaces localStorage. Models: `ListSession`, `GroceryItem`.
- **Service protocol abstraction**: `GroceryAnalysisService` protocol allows swapping `DirectAnthropicService` (BYOK) for `SupabaseAnalysisService` (Supabase) without UI changes. Similarly, `AuthService` protocol abstracts auth.
- **Environment-based service injection**: `authService` and `analysisService` are injected via SwiftUI `EnvironmentValues` from `AIsleListApp`. `ContentView.resolveAnalysisService()` prefers the injected service, falls back to BYOK.
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
- Supabase JWT gateway issue: `thoughts/supabase-jwt-gateway-issue.md` (--no-verify-jwt workaround + root cause hypotheses)
- Web app enhancement ideas: `ENHANCEMENT_RESEARCH.md` (root)
- Web app pending TODOs: `TODO.md` (root) -- drag-drop categories, styling, animations
