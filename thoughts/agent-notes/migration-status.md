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

### CLAUDE.md Documentation Updates (commits 0b4578a, b55afa3, dfe0bd2)

- Added iOS App section to CLAUDE.md with build system, data layer, services, and navigation details
- Added gotchas for SwiftData+CloudKit, SwiftData persistence, and abs() overflow
- Added top-level "Agent Notes" section pointing to `thoughts/agent-notes/`

### Not Yet Done

| Task | Description | Notes |
|------|-------------|-------|
| 1.15 | CloudKit configuration | Blocked: need iCloud container created in Apple Developer portal first. Entitlements file is empty intentionally. |

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
