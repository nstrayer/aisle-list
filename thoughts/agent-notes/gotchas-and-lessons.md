# Gotchas and Lessons Learned

## Critical: SwiftData + CloudKit

**Do NOT add CloudKit entitlements until the iCloud container is actually created in Apple Developer portal.**

Unconfigured CloudKit entitlements cause SwiftData to silently discard all writes. Inserts and saves appear to succeed (no errors thrown), but data is never actually persisted. This was discovered and fixed in commit `f3ad930`.

The fix was to:
1. Remove CloudKit entitlements from `AIsleList.entitlements` (now empty)
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
- **CORS**: Must handle `OPTIONS` preflight with `Access-Control-Allow-*` headers
- **Auth**: Reads `Authorization` header, creates Supabase client with it, calls `getUser()` to validate JWT
- **Scan limits**: Checks `subscriptions` table first (active/grace_period), then counts `scan_usage` rows for current calendar month. Free tier = 3 scans/month.
- **Error codes**: Returns `403` with `error: "scan_limit_reached"` and metadata (`scansUsed`, `scanLimit`, `upgradeRequired`) for client-side handling

## Dual-Mode ContentView Pattern

`ContentView` uses `isAuthMode` (derived from whether `authService` is non-nil in the environment) to switch between two view builders:
- `authModeContent`: checks `AuthState` enum (`.unknown` -> loading spinner, `.signedOut` -> `SignInView`, `.signedIn` -> `appContent`)
- `byokModeContent`: checks route (`.apiKey` -> `ApiKeyInputView`, default -> `appContent`)

The `onAppear` guard `if !isAuthMode` prevents the BYOK key check from running in auth mode.

## Sign in with Apple + Supabase

The nonce flow:
1. Generate random nonce string (32 chars from alphanumeric charset)
2. SHA256 hash the nonce and pass it in `ASAuthorizationAppleIDRequest.nonce`
3. After Apple callback, pass the raw (unhashed) nonce + `identityToken` to `supabase.auth.signInWithIdToken`
4. Supabase verifies the token against Apple's JWKS and creates/returns a session

Important: user cancellation (`ASAuthorizationError.canceled`) should not show an error message.

## Info.plist-Based Feature Detection

Supabase availability is detected at runtime by checking `Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL")`. If the key is missing or empty, the app runs in BYOK mode. This allows the same binary to work with or without Supabase configured.

## Anthropic API Integration

- Analysis uses `claude-sonnet-4-5-20250929` with forced tool_choice
- Sanity check uses `claude-haiku-4-5-20251001`
- Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`
- Response parsing: find content block with `type: "tool_use"`, decode `input`
- Prompts and tool schemas defined in `src/lib/anthropic-client.ts` (web), `Services/Implementations/DirectAnthropicService.swift` (iOS BYOK), and `supabase/functions/analyze-grocery-list/index.ts` (edge function)
