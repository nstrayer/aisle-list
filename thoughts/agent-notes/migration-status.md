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

### Info.plist Expansion (uncommitted)

Info.plist was expanded from just camera/photo usage descriptions to full bundle configuration: `CFBundleDisplayName` ("AIsle List"), version 1.0.0 (build 1), portrait-only orientation (`UISupportedInterfaceOrientations`), and empty `UILaunchScreen`. This change is staged but not yet committed.

### Documentation Updates

- Added iOS App section to CLAUDE.md with build system, data layer, services, and navigation details (commit 0b4578a)
- Added gotchas for SwiftData+CloudKit, SwiftData persistence, and abs() overflow
- Added top-level "Agent Notes" section pointing to `thoughts/agent-notes/` (commits b55afa3, dfe0bd2)
- Created agent-notes files: project-overview, ios-app-structure, migration-status, gotchas-and-lessons, next-steps (commit b93a2e8)
- Slimmed CLAUDE.md to defer detail to agent-notes (commit 2d3d740)

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

## Phase 2: Supabase Backend + Auth -- NOT STARTED

Key tasks: Supabase project setup, edge function for API proxy, Sign in with Apple + Supabase auth, swap DirectAnthropicService for SupabaseAnalysisService.

See `thoughts/prds/swiftui-migration-plan.md` Phase 2 section for full details.

## Phase 3: Subscriptions + App Store -- NOT STARTED

Key tasks: App Store Connect setup, StoreKit 2 implementation, paywall UI, Apple webhook for subscription events, usage gating.

See `thoughts/prds/swiftui-migration-plan.md` Phase 3 section and `thoughts/storekit2-research.md` for details.

## Phase 4: Polish + Growth -- NOT STARTED

Haptics, push notifications, widget, sharing, ASO, analytics. All independent tasks.
