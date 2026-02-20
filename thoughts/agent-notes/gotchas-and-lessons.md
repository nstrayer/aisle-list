# Gotchas and Lessons Learned

## Critical: SwiftData + CloudKit

**Do NOT add CloudKit entitlements until the iCloud container is actually created in Apple Developer portal.**

Unconfigured CloudKit entitlements cause SwiftData to silently discard all writes. Inserts and saves appear to succeed (no errors thrown), but data is never actually persisted. This was discovered and fixed in commit `f3ad930`.

The fix was to:
1. Remove CloudKit entitlements from `AIsleList.entitlements` (now empty)
2. Use explicit `ModelContainer` init with `fatalError` on failure instead of the `.modelContainer(for:)` SwiftUI modifier (which hides initialization errors)

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

## Anthropic API Integration

- Analysis uses `claude-sonnet-4-5-20250929` with forced tool_choice
- Sanity check uses `claude-haiku-4-5-20251001`
- Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`
- Response parsing: find content block with `type: "tool_use"`, decode `input`
- Prompts and tool schemas defined in `src/lib/anthropic-client.ts` (web) and `Services/Implementations/DirectAnthropicService.swift` (iOS)
