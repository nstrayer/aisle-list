# Gotchas and Lessons Learned

## Critical: SwiftData + CloudKit

**Do NOT add CloudKit entitlements until the iCloud container is actually created in Apple Developer portal.**

Unconfigured CloudKit entitlements cause SwiftData to silently discard all writes. Inserts and saves appear to succeed (no errors thrown), but data is never actually persisted. This was discovered and fixed in commit `f3ad930`.

The fix was to:
1. Remove CloudKit entitlements from `AIsleList.entitlements` (CloudKit removed; file now only has Sign in with Apple entitlement)
2. Use explicit `ModelContainer` init with `fatalError` on failure instead of the `.modelContainer(for:)` SwiftUI modifier (which hides initialization errors)

## CloudKit Model Compatibility

**CloudKit does not support `@Attribute(.unique)`.** Using it causes silent sync failures -- no errors, data just doesn't sync across devices. Removed `.unique` from `GroceryItem.id`.

Full CloudKit requirements for SwiftData models:
- No `@Attribute(.unique)` on any property
- All properties must have defaults or be optional
- All relationships must be optional
- `@Attribute(.externalStorage)` is fine (stores as CKAsset)

## SwiftData Persistence

Always call `modelContext.save()` explicitly after creating/modifying objects. The convenience auto-save behavior is not reliable in all scenarios. Fixed in commit `71cbf4d`.

Use explicit `ModelContainer` init pattern:
```swift
init() {
    do {
        let schema = Schema([ListSession.self, GroceryItem.self])
        let config = ModelConfiguration(isStoredInMemoryOnly: false)
        container = try ModelContainer(for: schema, configurations: [config])
    } catch {
        fatalError("Failed to create ModelContainer: \(error)")
    }
}
```

## UIGraphicsImageRenderer Scale

When using `UIGraphicsImageRenderer` for image preprocessing, set `format.scale = 1` to render at exact pixel dimensions. Without this, the renderer uses device scale (2x/3x on Retina displays), producing images 2-3x larger than intended.

## StoreSections Hash: utf16 vs unicodeScalars

When porting the JS `charCodeAt()` hash function to Swift, use `.utf16` not `.unicodeScalars`. JavaScript's `charCodeAt()` returns UTF-16 code units, and `unicodeScalars` can produce different values for characters above the Basic Multilingual Plane.

Also: iterate through `sectionOrder` array (not dictionary keys) for deterministic categorization precedence when multiple sections could match.

## Swift abs() Overflow with Int.min

**Never use `abs()` on a hash value or any Int that could be `Int.min`.**

In Swift, `abs(Int.min)` triggers a fatal overflow because `Int.min` (-9223372036854775808 on 64-bit) has no positive counterpart in two's complement (`Int.max` is 9223372036854775807). This causes a runtime crash.

Use `.magnitude` instead, which returns a `UInt` and handles `Int.min` safely:
```swift
// BAD - crashes when hash == Int.min
let index = abs(hash) % colors.count

// GOOD - safe for all values
let index = Int(hash.magnitude % UInt(colors.count))
```

Fixed in `AIsleList/Utilities/StoreSections.swift` in commit `f899314`.

## Input Trimming

Always trim `.whitespacesAndNewlines` on user text inputs before saving (API keys, session names, etc.). Several views needed this fix.

## xcodegen Workflow

The Xcode project is generated from `AIsleList/project.yml`. After adding or removing Swift files, run:
```bash
cd AIsleList && xcodegen generate
```

The generated `.xcodeproj` should not be committed to git (it's in the repo currently but `project.yml` is the source of truth).

## xcodegen Entitlements: path + properties

When declaring entitlements in `project.yml`, you need both the `path` (pointing to the `.entitlements` file) and `properties` (declaring the entitlement values). The `path` tells Xcode where the entitlements file lives, and `properties` ensures xcodegen writes the correct key-value pairs into it. Example for Sign in with Apple:

```yaml
entitlements:
  path: Resources/AIsleList.entitlements
  properties:
    com.apple.developer.applesignin:
      - Default
```

Without the `properties` block, the entitlements file may remain empty even if the file exists at the path. Commit 424e17a added this for Sign in with Apple.

## Web App Gotchas (Still Relevant)

- **Tailwind v4**: CSS-based config in `src/index.css`, NOT `tailwind.config.js`
- **Browser API calls**: `dangerouslyAllowBrowser: true` is intentional -- user provides their own key
- **PWA**: `vite-plugin-pwa` in `vite.config.ts`, service worker auto-generated on build
- **Dark mode**: Tailwind `dark:` variant with class strategy, persisted to localStorage
- **Image compression**: Images resized to 400px width + JPEG compressed before localStorage storage (~200KB max per thumbnail)
- **List history storage**: Uses separate localStorage keys for efficiency:
  - `grocery_sessions_index` -- lightweight index of all sessions (avoids loading full data)
  - `grocery_session_{id}` -- full session data (items only)
  - `grocery_session_image_{id}` -- compressed thumbnail
  - This split design allows storing 20+ lists within localStorage limits

## Supabase Edge Function Architecture

The edge function (`supabase/functions/analyze-grocery-list/index.ts`) runs on Deno and handles two actions:
- `analyze`: sends image to Sonnet with forced tool_choice for structured section extraction
- `sanity_check`: sends item list to Haiku for category correction

Key patterns:
- **CORS**: `CORS_HEADERS` constant applied to all responses via `jsonResponse()` helper. `OPTIONS` preflight returns empty body with CORS headers.
- **Auth**: Reads `Authorization` header, creates Supabase client with it, calls `getUser()` to validate JWT
- **Payload validation**: `validatePayload()` checks action type, required fields (imageBase64, mediaType whitelist for analyze; items array for sanity_check with per-item field validation). Returns 400 on invalid.
- **Scan limits**: Checks `subscriptions` table first (active/grace_period), then counts `scan_usage` rows for current calendar month. Free tier = 3 scans/month. Usage recorded after successful analysis only.
- **Error codes**: Returns `403` with `error: "scan_limit_reached"` and metadata (`scansUsed`, `scanLimit`, `upgradeRequired`) for client-side handling
- **Error hygiene**: Internal errors (Anthropic failures, exceptions) return generic "AI analysis failed" (502). Details logged server-side via `console.error`, never sent to client.

## Dual-Mode ContentView Pattern

`ContentView` uses `isAuthMode` (derived from whether `authService` is non-nil in the environment) to switch between two view builders:
- `authModeContent`: checks `AuthState` enum (`.unknown` -> loading spinner, `.signedOut` -> `SignInView`, `.signedIn` -> `appContent`)
- `byokModeContent`: checks route (`.apiKey` -> `ApiKeyInputView`, default -> `appContent`)

The `onAppear` block handles both modes:
- **Auth mode**: if route is `.apiKey`, navigates to `.upload` (the auth gate in the view builder handles sign-in)
- **BYOK mode**: if a saved API key exists in Keychain, navigates to `.upload`

### Auth Mode Routing Race (commit 7891258)

`authService` is set asynchronously in a `.task` modifier on `AIsleListApp`, so `onAppear` in `ContentView` can fire before `isAuthMode` becomes true. This caused the app to stay on the `.apiKey` route in auth mode. Fixed by adding `.onChange(of: isAuthMode)` to catch late transitions -- when `isAuthMode` flips to true and route is still `.apiKey`, it navigates to `.upload`.

## Sign in with Apple + Supabase

The nonce flow:
1. Generate random nonce string (32 chars from alphanumeric charset)
2. SHA256 hash the nonce and pass it in `ASAuthorizationAppleIDRequest.nonce`
3. After Apple callback, pass the raw (unhashed) nonce + `identityToken` to `supabase.auth.signInWithIdToken`
4. Supabase verifies the token against Apple's JWKS and creates/returns a session

Important: user cancellation (`ASAuthorizationError.canceled`) should not show an error message.

## Info.plist-Based Feature Detection

Supabase availability is detected at runtime by checking both `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Info.plist. Both must be present and valid (URL must parse, anon key must be non-empty) for auth mode. If either is missing or invalid, the app runs in BYOK mode. Detection happens in `AIsleListApp.setupServices()` via the failable `SupabaseAuthService(urlString:anonKey:)` init.

## Failable Init Over fatalError for Service Setup

`SupabaseAuthService` uses `init?(urlString:anonKey:)` returning nil instead of `fatalError` when configuration is invalid. This lets the caller (`setupServices()`) gracefully fall back to BYOK mode. Prefer failable inits for services that depend on optional runtime configuration.

## Stored Access Token (commit 2d4a2b6)

`SupabaseAuthService.accessToken` is a stored `private(set) var String?`, set explicitly during `signInWithApple` (from the returned session), `restoreSession` (from the restored session), and `signOut` (set to nil).

Previously this was a computed property reading `client.auth.currentSession?.accessToken`, but that approach caused timing issues -- the token could be nil or stale when read immediately after sign-in/restore, before the SDK's internal state had fully settled. Storing the token explicitly from the session response at the point of sign-in/restore guarantees it's available immediately.

The trade-off: a stored token won't auto-update if the Supabase SDK silently refreshes it in the background. If token expiry becomes an issue, consider re-reading from the session on each API call or listening for auth state change events.

## Record Usage After Success, Not Before

In the edge function, scan usage is recorded in the database only after a successful Anthropic API response. Previously it was recorded before the API call, meaning failed analyses still counted against the user's free tier limit. Always record consumption after the operation succeeds.

## Don't Leak Internal Errors to Clients

The edge function returns generic "AI analysis failed" (502) for all Anthropic-side errors instead of forwarding raw error text. Internal details are logged via `console.error` for debugging. This prevents leaking API keys, internal service names, or error formats to clients.

## Validate Nested Object Fields, Not Just Array Shape (commit 7891258)

The edge function's `validatePayload()` originally only checked that `sanity_check` items was a non-empty array (`Array.isArray(obj.items) && obj.items.length > 0`). This allowed malformed items (missing `id`, `name`, or `category` fields) to reach the Anthropic API and cause downstream failures. Now validates each item has string `id`, `name`, and `category` using `.every()`. General lesson: when validating arrays of objects, validate individual item structure, not just array presence.

## Don't Access Internal SDK Properties (commit 281dcd5)

`SupabaseClient.supabaseURL` is an internal property of the Supabase Swift SDK -- not part of the public API. Accessing it compiled but could break on SDK updates. Instead, store the base URL yourself during init and derive any needed URLs from it.

Pattern used: `SupabaseAuthService` stores `baseURL` (the raw URL passed to `SupabaseClient` init) and exposes a `functionsBaseURL` computed property (`baseURL.appendingPathComponent("functions/v1")`). `SupabaseAnalysisService` uses `authService.functionsBaseURL` instead of reaching through the client.

General lesson: when wrapping a third-party SDK, store configuration values you need rather than reaching into the SDK's internal state. This keeps your code resilient to SDK version changes.

## Anthropic API Integration

- Analysis uses `claude-sonnet-4-5-20250929` with forced tool_choice
- Sanity check uses `claude-haiku-4-5-20251001`
- Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`
- Response parsing: find content block with `type: "tool_use"`, decode `input`
- Prompts and tool schemas defined in `src/lib/anthropic-client.ts` (web), `Services/Implementations/DirectAnthropicService.swift` (iOS BYOK), and `supabase/functions/analyze-grocery-list/index.ts` (edge function)
