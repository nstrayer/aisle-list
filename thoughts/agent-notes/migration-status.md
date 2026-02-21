# SwiftUI Migration Status

Branch: `feature/swiftui-migration`

## Phase 1: Core SwiftUI App with BYOK -- COMPLETE

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
- Updated agent notes for Phase 2 hardening changes (commit 428a287)
- Marked Phase 1 complete, added commit refs to Phase 2 hardening section (commit 2e17840)
- Updated agent notes for SettingsView dual-mode and prior commits (commit a3ccbac)
- Updated agent notes for SDK functions.invoke() migration (commit 570015a)
- Updated agent notes for decode closure overload (commit c1a628b)

### CloudKit Compatibility Fix

- Removed `@Attribute(.unique)` from `GroceryItem.id` -- CloudKit does not support unique constraints and this causes silent sync failures (no errors, data just doesn't sync). See `gotchas-and-lessons.md` for full CloudKit model requirements.

### Deferred (independent of Phase 1 functionality)

| Task | Description | Notes |
|------|-------------|-------|
| 1.15 | CloudKit configuration | Need iCloud container created in Xcode (auto-registers in portal). Steps: add iCloud capability, enable CloudKit, create container `iCloud.com.aislelist.app`, add Background Modes with Remote notifications. No code changes needed. Can be done anytime. |

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
| 2.4 | Supabase analysis service | `Services/Implementations/SupabaseAnalysisService.swift` (calls edge function via SDK `client.functions.invoke()`, takes `SupabaseClient` directly, handles scan limit errors via `SupabaseAnalysisError`) |
| 2.5 | Integration | `AIsleListApp.swift` (auth/analysis service setup + environment injection), `ContentView.swift` (dual-mode: authModeContent vs byokModeContent), `ServiceEnvironmentKeys.swift` (added AuthServiceKey). BYOK kept as fallback when Supabase not configured via Info.plist detection. |

### Phase 2 Hardening (commits 6bcf987, 428a287)

Several robustness improvements across the Supabase integration:

**SupabaseAuthService -- failable init + stored access token**:
- `init()` changed to `init?(urlString:anonKey:)` -- returns nil instead of `fatalError` when URL/key invalid. Callers (`AIsleListApp.setupServices()`) use `guard let` and fall back to BYOK.
- `accessToken` is a stored `private(set) var String?`, set explicitly in `signInWithApple` (from returned session), `restoreSession` (from restored session), and `signOut` (set to nil). This was briefly a computed property reading `client.auth.currentSession?.accessToken`, but that caused timing issues where the token was unavailable immediately after sign-in/restore (commit 2d4a2b6 reverted to stored property).

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
6. ~~**Add to Info.plist**~~ -- DONE (commit 424e17a): `SUPABASE_URL` and `SUPABASE_ANON_KEY` added to `project.yml` info properties
7. **Regenerate Xcode project**: `cd AIsleList && xcodegen generate`

Note: Since `SUPABASE_URL` and `SUPABASE_ANON_KEY` are now baked into `project.yml` (step 6), the app will attempt auth mode on any build generated from this config. BYOK fallback only occurs if the failable `SupabaseAuthService` init fails (e.g., invalid URL or empty key). Steps 1-5 and 7 are still required for auth mode to actually function end-to-end.

### Auth Routing Race + Validation Fix (commit 7891258)

Two fixes applied:

1. **ContentView auth mode routing race**: `authService` is set async in `.task`, so `onAppear` can fire before `isAuthMode` is true. Added `.onChange(of: isAuthMode)` to catch late transitions and navigate from `.apiKey` to `.upload` when auth mode activates.

2. **Edge function `sanity_check` item validation**: `validatePayload()` now validates each item in the `sanity_check` items array has string `id`, `name`, and `category` fields (previously only checked for non-empty array). Prevents malformed payloads from reaching the Anthropic API.

### Supabase SDK Internal Property Fix (commit 281dcd5, partially reversed by 8625cee)

`SupabaseAnalysisService` was accessing `authService.supabaseClient.supabaseURL` -- an internal property of the Supabase Swift SDK, not part of the public API. Fixed by:
- `SupabaseAuthService` now stores `baseURL` during init and exposes `functionsBaseURL` (computed: `baseURL.appendingPathComponent("functions/v1")`)
- `SupabaseAnalysisService` uses `authService.functionsBaseURL.appendingPathComponent("analyze-grocery-list")` instead of reaching through to `SupabaseClient`

Note: commit 8625cee re-introduced `supabaseClient` on `SupabaseAuthService` -- but now it's passed to `SupabaseAnalysisService` at init time (not accessed to read internal properties). See the SDK invoke migration section below.

### Optional Session Access Fix (commit e93a833, superseded by 2d4a2b6)

`SupabaseAuthService.accessToken` was a computed property accessing `client.auth.currentSession.accessToken` without optional chaining. Fixed with `?.` in e93a833. Later, commit 2d4a2b6 changed `accessToken` from computed to a stored property set explicitly on sign-in/restore/sign-out, making this fix moot (the computed property no longer exists).

### Sign in with Apple Entitlement + Supabase Config (commit 424e17a)

Added the Sign in with Apple entitlement via `project.yml`:
- `AIsleList.entitlements` now contains `com.apple.developer.applesignin` with `Default` value
- `project.yml` entitlements section updated with `properties` block to declare the entitlement (in addition to the `path` reference)
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` added directly to `project.yml` info properties, so they are baked into Info.plist on `xcodegen generate`

This means manual step 6 from the "Manual Steps Required" list is now done -- Supabase credentials are committed in `project.yml`.

### Stored Access Token Fix (commit 2d4a2b6)

Reverted `accessToken` from a computed property back to a stored `private(set) var String?`. The computed approach (reading `client.auth.currentSession?.accessToken`) had timing issues -- the token could be unavailable immediately after sign-in or session restore, before the SDK's internal state settled. Now set explicitly from the session response in `signInWithApple`, `restoreSession`, and cleared in `signOut`.

### SettingsView Dual-Mode Update (commit 588b6d0)

`SettingsView` now supports both auth and BYOK modes:
- **Auth mode** (`isAuthMode` derived from `authService` environment): shows Account section with signed-in user ID prefix and a "Sign Out" button that calls `authService?.signOut()` and dismisses the view.
- **BYOK mode** (no auth service): shows the original API Key section (masked key display, change key, remove key).
- Mode detection uses `@Environment(\.authService)` -- same pattern as `ContentView`.
- Extracted `accountSection` and `apiKeySection` as `@ViewBuilder` computed properties for clarity.
- Only loads the masked API key on appear when in BYOK mode.
- Removed `#Preview` block.

### Edge Function apikey Header Fix (commit fc3739d, superseded by 8625cee)

`SupabaseAnalysisService.invokeFunction()` was sending `Authorization: Bearer <token>` but missing the `apikey` header. Supabase's API gateway requires the anon key as an `apikey` header on all requests (the SDK adds it automatically, but raw `URLRequest` calls do not). Fixed by:
- `SupabaseAuthService` now exposes `anonKey` as a public stored property (set during init)
- `invokeFunction()` adds `request.setValue(authService.anonKey, forHTTPHeaderField: "apikey")`

This fix was superseded by commit 8625cee, which switched to the SDK's `functions.invoke()` (handles all headers automatically).

### SDK functions.invoke() Migration (commit 8625cee, refined in 50c95c7)

Replaced raw `URLSession` HTTP calls with the Supabase SDK's built-in `client.functions.invoke()` in `SupabaseAnalysisService`. This was the culmination of iterative fixes to manual header management (apikey header in fc3739d, auth token in 2d4a2b6).

**Changes**:
- `SupabaseAnalysisService` now takes a `SupabaseClient` directly via `init(client:)` instead of a `SupabaseAuthService` reference
- `SupabaseAuthService` re-exposes `supabaseClient` (a read-only computed property returning the internal `client`) so `AIsleListApp` can pass it to the analysis service at setup
- `AIsleListApp.setupServices()` changed from `SupabaseAnalysisService(authService: auth)` to `SupabaseAnalysisService(client: auth.supabaseClient)`
- `invokeFunction()` simplified: no more manual URL construction, header setup
- `import Supabase` added to `SupabaseAnalysisService.swift` (now uses `SupabaseClient` type directly)

**What was removed**:
- Manual `URLRequest` construction (URL, method, headers, body)
- `URLSession.shared.data(for:)` call
- Dependency on `authService.accessToken`, `authService.functionsBaseURL`, `authService.anonKey`
- Debug print statements from fc3739d

### Decode Closure Overload (commit 50c95c7, error handling fixed later)

Refined `invokeFunction()` to use the decode closure overload of `functions.invoke()` instead of calling it and then separately deserializing the response.

**Important**: In supabase-swift 2.41.1, the decode closure only runs for 2xx responses. Non-2xx responses throw `FunctionsError.httpError(code:data:)` before the closure executes. Error handling for HTTP failures (401, 403 scan_limit_reached, etc.) must happen in a `catch FunctionsError` block wrapping the `invoke` call, parsing the error body from the `data` parameter of `FunctionsError.httpError`.

### Not Yet Done

- Delete BYOK files (DirectAnthropicService, ApiKeyInputView, KeychainHelper) -- deferred until Supabase is verified working
- Show remaining free scans on upload screen

## Phase 3: Subscriptions + App Store -- NOT STARTED

Key tasks: App Store Connect setup, StoreKit 2 implementation, paywall UI, Apple webhook for subscription events, usage gating.

See `thoughts/prds/swiftui-migration-plan.md` Phase 3 section and `thoughts/storekit2-research.md` for details.

## Phase 4: Polish + Growth -- NOT STARTED

Haptics, push notifications, widget, sharing, ASO, analytics. All independent tasks.
