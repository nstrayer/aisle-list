# SwiftUI Migration Status

Branch: `feature/swiftui-migration`

## Phase 1: Core SwiftUI App with BYOK -- IN PROGRESS

### Completed Tasks

| Task | Description | Key Files |
|------|-------------|-----------|
| 1.1 | Xcode project scaffolding | `AIsleListApp.swift`, `project.yml` |
| 1.2 | SwiftData models | `Models/` (ListSession, GroceryItem, GrocerySection, CategorySuggestion, Route) |
| 1.3 | Store sections mapping | `Utilities/StoreSections.swift` |
| 1.4 | Image preprocessing | `Utilities/ImagePreprocessor.swift` |
| 1.5 | Keychain + API key input | `Utilities/KeychainHelper.swift`, `Views/ApiKey/ApiKeyInputView.swift` |
| 1.6 | Service protocols + DirectAnthropicService | `Services/` directory |
| 1.7 | Camera picker | `Views/Upload/CameraPicker.swift` |
| 1.8 | Image upload screen | `Views/Upload/ImageUploadView.swift` |
| 1.9 | Clarify screen | `Views/Clarify/ClarifyView.swift`, `SectionCard.swift` |
| 1.10 | Grocery list screen (6 views) | `Views/List/` (GroceryListView, Header, SectionView, ItemRow, SanityCheckBanner, AddItemButton) |
| 1.11 | History panel | `Views/History/HistoryView.swift`, `SessionRow.swift` |
| 1.12 | Settings screen | `Views/Settings/SettingsView.swift` |
| 1.13 | App ViewModel + navigation | `ViewModels/AppViewModel.swift`, `ContentView.swift` |
| 1.14 | Network monitor | `Utilities/NetworkMonitor.swift` |

### Info.plist Configuration

Info.plist expanded from camera/photo usage descriptions to full bundle configuration: `CFBundleDisplayName` ("AIsle List"), version 1.0.0 (build 1), portrait-only orientation (`UISupportedInterfaceOrientations`), empty `UILaunchScreen`, and optional `SUPABASE_URL`/`SUPABASE_ANON_KEY` keys for dual-mode detection.

### Documentation Updates

- Added iOS App section to CLAUDE.md with build system, data layer, services, and navigation details (commit 0b4578a)
- Added gotchas for SwiftData+CloudKit, SwiftData persistence, and abs() overflow
- Added top-level "Agent Notes" section pointing to `thoughts/agent-notes/` (commits b55afa3, dfe0bd2)
- Created agent-notes files: project-overview, ios-app-structure, migration-status, gotchas-and-lessons, next-steps (commit b93a2e8)
- Slimmed CLAUDE.md to defer detail to agent-notes (commit 2d3d740)
- Updated CLAUDE.md: project overview to "AIsle List" with three codebases, condensed tech stack (Web/iOS/Backend), added Supabase Backend section, expanded iOS section with dual-mode info (commit f009e49)
- Updated agent notes for Supabase auth + analysis integration (commit 18fa2a7)

### CloudKit Compatibility Fix

- Removed `@Attribute(.unique)` from `GroceryItem.id` -- CloudKit does not support unique constraints and this causes silent sync failures (no errors, data just doesn't sync). See `gotchas-and-lessons.md` for full CloudKit model requirements.

### Not Yet Done

| Task | Description | Notes |
|------|-------------|-------|
| 1.15 | CloudKit configuration | Blocked: need iCloud container created in Xcode (auto-registers in portal). Steps: add iCloud capability, enable CloudKit, create container `iCloud.com.aislelist.app`, add Background Modes with Remote notifications. No code changes needed. |

### abs() Overflow Fix (commit f899314)

- `StoreSections`: Replaced `abs(hash)` with `hash.magnitude` to avoid fatal overflow when hash equals `Int.min`. See `gotchas-and-lessons.md` for details.

### Code Review Fixes Applied (commit 982cb1d)

These were addressed in a prior commit:
- `ImagePreprocessor`: Use `format.scale=1` for UIGraphicsImageRenderer to render at exact pixel dimensions
- `StoreSections`: Use `utf16` instead of `unicodeScalars` in hash to match JS `charCodeAt()` behavior; iterate sectionOrder for deterministic categorization
- `GroceryItemRow`: Skip `onRename` when text unchanged to prevent unwanted re-categorization
- `GroceryListView`: Sort dynamic section names for deterministic ordering; use `max(sortOrder)+1` for new items
- `SettingsView`: Trim whitespace before saving API key, check KeychainHelper.save return value
- `HistoryView`: Trim with `.whitespacesAndNewlines` for rename validation
- `ApiKeyInputView`: Trim with `.whitespacesAndNewlines` and pass trimmed value

## Phase 2: Supabase Backend + Auth -- IN PROGRESS

### Completed Tasks

| Task | Description | Key Files |
|------|-------------|-----------|
| 2.1 | Supabase project + schema | `supabase/migrations/001_initial.sql` (scan_usage, subscriptions tables with RLS), `supabase/config.toml` (local dev config, project_id: kroger-list) |
| 2.2 | Edge function (API proxy) | `supabase/functions/analyze-grocery-list/index.ts` (Deno, JWT auth, subscription check, free tier 3 scans/month, dual action: analyze + sanity_check) |
| 2.3 | Auth service | `Services/Protocols/AuthService.swift` (AuthState enum + protocol), `Services/Implementations/SupabaseAuthService.swift` (Sign in with Apple via Supabase), `Views/Auth/SignInView.swift` (Apple sign-in UI + nonce handling) |
| 2.4 | Supabase analysis service | `Services/Implementations/SupabaseAnalysisService.swift` (calls edge function, handles scan limit errors via `SupabaseAnalysisError`) |
| 2.5 | Integration | `AIsleListApp.swift` (auth/analysis service setup + environment injection), `ContentView.swift` (dual-mode: authModeContent vs byokModeContent), `ServiceEnvironmentKeys.swift` (added AuthServiceKey). BYOK kept as fallback when Supabase not configured via Info.plist detection. |

### Phase 2 Hardening (latest changes)

Several robustness improvements across the Supabase integration:

**SupabaseAuthService -- failable init + computed access token**:
- `init()` changed to `init?(urlString:anonKey:)` -- returns nil instead of `fatalError` when URL/key invalid. Callers (`AIsleListApp.setupServices()`) use `guard let` and fall back to BYOK.
- `accessToken` changed from stored `private(set) var` to a computed property reading `client.auth.currentSession.accessToken`. Avoids stale tokens -- the Supabase SDK handles refresh internally.
- Manual `accessToken = ...` / `accessToken = nil` assignments removed from `signInWithApple`, `restoreSession`, `signOut`.

**AIsleListApp.setupServices() -- guard-let early return**:
- Uses `guard let` with new failable `SupabaseAuthService(urlString:anonKey:)`. Returns early to BYOK mode on failure instead of nested if-let.
- Both `SUPABASE_URL` and `SUPABASE_ANON_KEY` must be present (previously only URL was checked).

**ContentView.onAppear -- auth mode routing fix**:
- In auth mode, if route is `.apiKey` on appear, immediately navigate to `.upload` (the auth gate in the view builder handles sign-in display).
- Previously only handled BYOK path, causing auth mode to get stuck on the API key screen.

**SignInView -- nonce charset bug fix**:
- Charset string was missing 'W' (`...STUVXYZ...` -> `...STUVWXYZ...`). This slightly reduced entropy of generated nonces.

**Edge function hardening**:
- Extracted `CORS_HEADERS` constant and `jsonResponse()` helper to reduce response boilerplate.
- Added `validatePayload()` function for explicit request validation (action, imageBase64, mediaType whitelist, items array).
- Scan usage recording moved to after successful Anthropic response (was before -- failed scans no longer count against the user).
- Error responses no longer leak internal details (Anthropic error text). Uses generic "AI analysis failed" with 502 status.
- Added JSON body parsing error handling (returns 400 on malformed JSON).
- Internal errors logged via `console.error` instead of returned to client.

### New Dependencies

- **Supabase Swift SDK** (`supabase-swift` >= 2.0.0) added to `project.yml` as SPM package
- Edge function uses `@supabase/supabase-js@2` via esm.sh (Deno)

### Manual Steps Required

Before the Supabase path works, you need to:

1. **Create a Supabase project** at https://supabase.com/dashboard
2. **Run the migration**: `supabase db push` or apply `001_initial.sql` via SQL editor
3. **Deploy the edge function**: `supabase functions deploy analyze-grocery-list`
4. **Set edge function secret**: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
5. **Enable Apple auth** in Supabase dashboard (Authentication > Providers > Apple)
6. **Add to Info.plist** (or project.yml info properties):
   - `SUPABASE_URL`: your project URL (e.g., `https://xxxx.supabase.co`)
   - `SUPABASE_ANON_KEY`: your project's anon/public key
7. **Regenerate Xcode project**: `cd AIsleList && xcodegen generate`

Until these steps are done, the app falls back to BYOK mode automatically.

### Not Yet Done

- Delete BYOK files (DirectAnthropicService, ApiKeyInputView, KeychainHelper) -- deferred until Supabase is verified working
- Update SettingsView: remove API Key section, add Account section (email, sign out)
- Show remaining free scans on upload screen

## Phase 3: Subscriptions + App Store -- NOT STARTED

Key tasks: App Store Connect setup, StoreKit 2 implementation, paywall UI, Apple webhook for subscription events, usage gating.

See `thoughts/prds/swiftui-migration-plan.md` Phase 3 section and `thoughts/storekit2-research.md` for details.

## Phase 4: Polish + Growth -- NOT STARTED

Haptics, push notifications, widget, sharing, ASO, analytics. All independent tasks.
