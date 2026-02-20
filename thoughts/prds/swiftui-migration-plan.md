# AIsle List: SwiftUI Migration Implementation Plan

## Context

The Smart Grocery List app is being rewritten from React web to a native SwiftUI iOS app. The React codebase will not be maintained. The app uses Claude AI to read handwritten grocery lists from photos and organize items by Kroger store sections.

**Why:** Native camera access, SwiftData + iCloud sync, Apple IAP subscriptions, better offline experience.

**Key decisions:**
- SwiftData + CloudKit for list persistence (not Supabase)
- Supabase only for: auth (JWT), edge functions (API proxy), scan usage tracking
- Service protocol abstraction layer (Supabase can be swapped)
- StoreKit 2 for subscriptions (Apple Small Business Program, 15%)
- Phase 1 starts with BYOK (bring your own API key) to validate app before adding backend

**Reference docs (in `thoughts/`):**
- `subscription-and-ios-research.md` -- executive summary
- `subscription-research.md` -- backend, auth, API costs
- `ios-conversion-research.md` -- SwiftUI architecture, Apple IAP
- `swiftui-component-mapping.md` -- React-to-SwiftUI component mapping
- `swiftui-architecture-research.md` -- SwiftUI patterns, supabase-swift, service abstraction
- `storekit2-research.md` -- StoreKit 2 implementation details

---

## Phase 1: Core SwiftUI App with BYOK

All tasks in Phase 1 can be worked on in parallel unless noted otherwise. Each task produces specific files with clear interfaces.

### Task 1.1: Xcode Project Scaffolding
**Depends on:** Nothing
**Produces:** Xcode project, app entry point, root view

Create the Xcode project:
- iOS 17.0+ target, Swift 5.10+
- Bundle ID: `com.aislelist.app` (or similar)
- Enable CloudKit capability
- Add `NSCameraUsageDescription`: "AIsle List uses your camera to photograph handwritten grocery lists"
- Add `NSPhotoLibraryUsageDescription`: "AIsle List accesses your photos to read handwritten grocery lists"

Files to create:
- `AIsleListApp.swift` -- @main entry point with ModelContainer for `[ListSession.self, GroceryItem.self]`
- `ContentView.swift` -- Root view with NavigationStack, routes based on app state

```swift
@main
struct AIsleListApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: [ListSession.self, GroceryItem.self])
    }
}
```

---

### Task 1.2: SwiftData Models
**Depends on:** Nothing
**Produces:** `Models/` folder with all data types

Files to create:
- `Models/ListSession.swift` -- @Model, has @Relationship to items, thumbnail as @Attribute(.externalStorage)
- `Models/GroceryItem.swift` -- @Model, has session relationship, unique id
- `Models/GrocerySection.swift` -- Codable struct for AI response (not SwiftData)
- `Models/CategorySuggestion.swift` -- Codable struct: id, name, from, to
- `Models/Route.swift` -- Navigation enum: apiKey, upload, clarify([GrocerySection]), list(ListSession)

Source reference for data types: `src/lib/types.ts`

SwiftData models:
```swift
@Model final class ListSession {
    var name: String
    var createdAt: Date
    var updatedAt: Date
    @Attribute(.externalStorage) var thumbnailData: Data?
    @Relationship(deleteRule: .cascade, inverse: \GroceryItem.session)
    var items: [GroceryItem] = []
    // Computed: itemCount, checkedCount, hasImage
}

@Model final class GroceryItem {
    @Attribute(.unique) var id: String
    var name: String
    var category: String
    var isChecked: Bool
    var sortOrder: Int
    var session: ListSession?
}
```

AI response struct (not persisted):
```swift
struct GrocerySection: Identifiable, Codable, Hashable {
    let id: UUID
    var name: String
    var type: SectionType // grocery, meal_plan, crossed_out, notes
    var items: [String]
}
```

---

### Task 1.3: Store Sections Mapping
**Depends on:** Nothing
**Produces:** `Utilities/StoreSections.swift`

Port from: `src/lib/store-sections.ts` (338 lines)

This is a 1:1 port of the store section taxonomy:
- `STORE_SECTIONS`: Dictionary of 12 sections with ~100 keywords total (Produce, Bakery, Meat & Seafood, Dairy & Eggs, Frozen Foods, Pantry & Canned Goods, International, Condiments & Sauces, Snacks, Beverages, Household & Cleaning, Other)
- `SECTION_ORDER`: Display order array
- `categorizeItem(_ name: String) -> String`: Keyword substring matching, returns section name or "Other"
- `SectionStyle`: Map Tailwind color classes to SwiftUI Color values (background, text, border)
- `getSectionStyle(_ name: String) -> SectionStyle`: Returns colors for known sections, deterministic hash for dynamic sections
- 6-color palette for dynamic sections (same as React's `DYNAMIC_SECTION_COLORS`)

Read the full `src/lib/store-sections.ts` file for the complete keyword list and color mappings.

---

### Task 1.4: Image Preprocessing
**Depends on:** Nothing
**Produces:** `Utilities/ImagePreprocessor.swift`

Port from: `src/lib/image-processing.ts` (128 lines)

Constants (match React exactly):
- `maxLongestEdge`: 1568
- `maxBase64Bytes`: 5_242_880 (5MB)
- `initialQuality`: 0.85
- `minQuality`: 0.40
- `qualityStep`: 0.10
- `fallbackLongestEdge`: 1092

Functions:
- `preprocessForAPI(_ image: UIImage) -> (data: Data, base64: String)` -- resize to maxLongestEdge, JPEG compress at initialQuality, if base64 > 5MB reduce quality in steps, if still too big fallback to fallbackLongestEdge at minQuality
- `createThumbnail(_ image: UIImage) -> Data?` -- 400px wide, 0.6 JPEG quality (for SwiftData storage)
- Uses `UIGraphicsImageRenderer` for resize, `UIImage.jpegData(compressionQuality:)` for compress

---

### Task 1.5: Keychain Helper + API Key Input
**Depends on:** Nothing
**Produces:** `Utilities/KeychainHelper.swift`, `Views/ApiKey/ApiKeyInputView.swift`

`KeychainHelper`:
- `static func save(key: String, data: Data) -> Bool` -- SecItemAdd
- `static func load(key: String) -> Data?` -- SecItemCopyMatching
- `static func delete(key: String)` -- SecItemDelete

`ApiKeyInputView`:
- App title text
- SecureField for API key
- "Save & Continue" button (disabled when empty)
- Brief explanation of how it works
- Link to console.anthropic.com

This is temporary -- removed in Phase 2 when Supabase auth replaces BYOK.

---

### Task 1.6: Service Protocols + Direct Anthropic Service
**Depends on:** Task 1.2 (models), Task 1.4 (image preprocessing)
**Produces:** `Services/Protocols/GroceryAnalysisService.swift`, `Services/Implementations/DirectAnthropicService.swift`, `Services/Environment/ServiceEnvironmentKeys.swift`

Protocol:
```swift
protocol GroceryAnalysisService {
    func analyzeImage(_ imageData: Data) async throws -> [GrocerySection]
    func sanityCheckCategories(_ items: [ItemCategoryPair]) async throws -> [ItemCategoryPair]
}
struct ItemCategoryPair: Codable { let id: String; let name: String; let category: String }
```

`DirectAnthropicService` -- raw URLSession calls to `https://api.anthropic.com/v1/messages`:
- Port from: `src/lib/anthropic-client.ts` (226 lines)
- `analyzeImage`: Model `claude-sonnet-4-5-20250929`, same `ANALYZE_PROMPT`, same `grocery_sections` tool definition, forced tool_choice
- `sanityCheckCategories`: Model `claude-haiku-4-5-20251001`, same `SANITY_CHECK_PROMPT` + formatted item list, same `categorized_items` tool definition
- Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`
- Parse response: find content block with `type: "tool_use"`, decode `input`

Read `src/lib/anthropic-client.ts` for exact prompt text, tool schemas, and response parsing logic.

`ServiceEnvironmentKeys.swift`:
```swift
struct GroceryAnalysisServiceKey: EnvironmentKey {
    static let defaultValue: any GroceryAnalysisService = DirectAnthropicService()
}
extension EnvironmentValues {
    var analysisService: any GroceryAnalysisService { get/set }
}
```

---

### Task 1.7: Camera Picker
**Depends on:** Nothing
**Produces:** `Views/Upload/CameraPicker.swift`

`UIViewControllerRepresentable` wrapping `UIImagePickerController` with `.camera` source type:
- `@Binding var image: UIImage?`
- `@Environment(\.dismiss)` to close
- Coordinator as delegate for `imagePickerController(_:didFinishPickingMediaWithInfo:)` and `imagePickerControllerDidCancel`
- Presented via `.fullScreenCover`

---

### Task 1.8: Image Upload Screen
**Depends on:** Task 1.2 (models), Task 1.7 (camera picker)
**Produces:** `Views/Upload/ImageUploadView.swift`

Replaces: `src/components/ImageUpload.tsx` (305 lines)

Contains:
- App title ("AIsle List" or similar)
- Camera button -> presents CameraPicker as `.fullScreenCover`
- PhotosPicker (from PhotosUI) for library selection
- Preview of selected image
- Loading overlay during AI analysis
- "Recent Lists" section: `@Query(sort: \ListSession.createdAt, order: .reverse)` showing top 3 sessions as tappable cards
- Toolbar: settings gear, history clock icon

What is NOT ported: drag-and-drop handlers (irrelevant on iOS), "Change API Key" link (moved to Settings)

---

### Task 1.9: Clarify Screen
**Depends on:** Task 1.2 (models)
**Produces:** `Views/Clarify/ClarifyView.swift`, `Views/Clarify/SectionCard.swift`

Replaces: `src/components/ClarifyScreen.tsx` (130 lines)

`ClarifyView`:
- Receives `[GrocerySection]` from navigation
- `@State var selected: Set<UUID>` -- initialized with all sections except `.crossedOut`
- List/ScrollView of SectionCard views
- "Add Selected to List" button (disabled when empty)
- Back navigation to upload

`SectionCard`:
- Toggle checkbox
- Section name (bold)
- Type badge: colored capsule (grocery=green, meal_plan=purple, crossed_out=gray, notes=yellow)
- Item count
- First 5 items as preview, "+ N more" if truncated

---

### Task 1.10: Grocery List Screen
**Depends on:** Task 1.2 (models), Task 1.3 (store sections), Task 1.6 (analysis service)
**Produces:** 6 files in `Views/List/`

Replaces: `src/components/GroceryList.tsx` (804 lines) + `src/components/SwipeableItem.tsx` (101 lines)

This is the most complex screen. Decompose into focused views:

**`GroceryListView.swift`** (container):
- Fetches items for current session
- Groups by category: known sections in SECTION_ORDER, dynamic sections alphabetically, "Other" last
- Within each section: unchecked first, then checked (with settling delay)
- Toolbar: "New List", history, settings, image thumbnail

**`GroceryListHeader.swift`**:
- Progress ring: `Circle().trim(from: 0, to: progress)` with animated stroke
- Percentage text overlay
- Celebration animation at 100% (scale + rotation spring)
- Tappable session name that becomes TextField on tap
- Subtitle: "X of Y items checked"

**`GrocerySectionView.swift`**:
- Section header with colored background (from StoreSections)
- Item count badge
- ForEach of GroceryItemRow

**`GroceryItemRow.swift`**:
- Checkbox (custom toggle with scale spring on check)
- Item name with strikethrough when checked
- Category badge (caption2 capsule)
- Tap name to edit inline (TextField replaces Text)
- Auto-recategorize on name commit via `categorizeItem()`
- `.swipeActions(edge: .trailing)` with destructive Delete -- **replaces entire SwipeableItem.tsx**
- `.contextMenu` with all section names for recategorization -- **replaces createPortal category picker**
- Custom section entry option in context menu

**`SanityCheckBanner.swift`**:
- "Refining categories..." spinner state
- Error banner with dismiss + "Re-categorize" retry button
- Suggestion banner: expandable list of changes (from -> to), Accept/Dismiss buttons
- "Re-categorize items with AI" button when items changed since last check

**`AddItemButton.swift`**:
- Dashed outline button
- Creates new GroceryItem in edit mode (empty name, "Other" category)

**Settling behavior**:
- `@State var settlingItems: Set<String>` tracks items that were just checked
- On check: add to settlingItems, `Task.sleep(for: .milliseconds(800))`, remove from settlingItems
- Items in settlingItems render in unchecked position; removal triggers `withAnimation` reorder
- If unchecked while settling, cancel the task

Read `src/components/GroceryList.tsx` carefully for the full grouping, sorting, sanity check, and settling logic.

---

### Task 1.11: History Panel
**Depends on:** Task 1.2 (models)
**Produces:** `Views/History/HistoryView.swift`, `Views/History/SessionRow.swift`

Replaces: `src/components/HistoryPanel.tsx` (180 lines)

Presented as `.sheet` (replaces custom slide-out panel):

`HistoryView`:
- `@Query(sort: \ListSession.createdAt, order: .reverse) var sessions`
- NavigationStack with "List History" title
- List of SessionRow
- `.swipeActions` for delete and rename (rename via alert with TextField)
- Tap row to load session and dismiss sheet

`SessionRow`:
- Session name (bold)
- Creation date (formatted)
- `ProgressView(value: Double(checkedCount) / Double(itemCount))` horizontal bar
- Image indicator if hasImage

---

### Task 1.12: Settings Screen
**Depends on:** Task 1.5 (keychain)
**Produces:** `Views/Settings/SettingsView.swift`

Form with sections:
- Appearance: dark mode toggle via `@AppStorage("prefersDarkMode")`
- API Key: show masked key, "Change Key" button, "Remove Key" button
- About: app version

---

### Task 1.13: App ViewModel + Navigation
**Depends on:** Task 1.2, 1.3, 1.4, 1.6 (models, store sections, image preprocessing, analysis service)
**Produces:** `ViewModels/AppViewModel.swift`

Replaces: `src/App.tsx` state management (418 lines)

```swift
@Observable
final class AppViewModel {
    var currentRoute: Route = .apiKey
    var sections: [GrocerySection] = []
    var isAnalyzing = false
    var analysisError: String?
    var isSanityChecking = false
    var pendingSuggestions: [CategorySuggestion]?
    var sanityCheckError: String?
    var currentSession: ListSession?
    var uploadedImage: UIImage?

    private var sanityCheckTask: Task<Void, Never>?
    private var lastCheckedFingerprint: String?
}
```

Key methods:
- `handleImageUpload(_ image: UIImage)` -- preprocess, call analyzeImage, navigate to clarify
- `handleConfirmSections(_ selected: [GrocerySection], modelContext:)` -- flatten items, categorize, create ListSession, save thumbnail, navigate to list, start sanity check
- `runSanityCheck(items:)` -- cancels previous task, calls sanityCheckCategories, compares results, sets pendingSuggestions
- `acceptSuggestions()` -- applies category changes to items
- `handleNewList()` -- clears state, navigates to upload
- `loadSession(_ session: ListSession)` -- sets current session, navigates to list

Session name generation: `DateFormatter` with "EEEE, MMM d" format, deduplicate with "(2)" suffix.

Fingerprint for sanity check: hash of sorted item ids + categories (same concept as React's `generateFingerprint`).

---

### Task 1.14: Network Monitor
**Depends on:** Nothing
**Produces:** `Utilities/NetworkMonitor.swift`

`@Observable` class wrapping `NWPathMonitor`:
- `var isConnected: Bool`
- Start monitoring on init, stop on deinit
- Inject via `@Environment`

---

### Task 1.15: CloudKit Configuration
**Depends on:** Task 1.1 (project), Task 1.2 (models)
**Produces:** Xcode project configuration changes

- Add iCloud capability in Signing & Capabilities
- Enable CloudKit, create container `iCloud.com.yourcompany.aislelist`
- SwiftData automatically syncs @Model entities when CloudKit container is configured
- No code changes needed beyond project config

---

## Phase 2: Supabase Backend + Auth

**Depends on:** Phase 1 complete

### Task 2.1: Supabase Project + Schema
**Depends on:** Nothing (can prep in parallel with Phase 1)
**Produces:** `supabase/migrations/001_initial.sql`, Supabase project configuration

Create Supabase project. Database schema:
```sql
CREATE TABLE scan_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_scan_usage_user_month ON scan_usage(user_id, created_at);
ALTER TABLE scan_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own usage" ON scan_usage FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    original_transaction_id TEXT UNIQUE NOT NULL,
    product_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
```

Enable Apple auth provider in dashboard. Configure Apple Sign In credentials.

### Task 2.2: Edge Function -- analyze-grocery-list
**Depends on:** Task 2.1
**Produces:** `supabase/functions/analyze-grocery-list/index.ts`

Accepts POST with `Authorization: Bearer <jwt>` and body:
```json
{
  "action": "analyze" | "sanity_check",
  "imageBase64": "...",       // only for analyze
  "mediaType": "image/jpeg",  // only for analyze
  "items": [...]              // only for sanity_check
}
```

Logic:
1. Create Supabase client from auth header (auto JWT validation)
2. Get user ID from auth
3. For "analyze" action only: check subscription OR free tier (count scan_usage this month, limit 3)
4. For "analyze" action only: INSERT into scan_usage
5. Call Anthropic API with `ANTHROPIC_API_KEY` env var
6. Return structured response

Port exact prompts and tool definitions from `src/lib/anthropic-client.ts`.

Error responses:
- 401: invalid/expired JWT
- 403: `{ error: "scan_limit_reached", scansUsed: 3, scanLimit: 3, upgradeRequired: true }`
- 500: Anthropic API error

### Task 2.3: Auth Service
**Depends on:** Task 2.1
**Produces:** `Services/Implementations/SupabaseAuthService.swift`, `Views/Auth/SignInView.swift`

Add SPM dependency: `https://github.com/supabase/supabase-swift` (from: "2.0.0")

`SupabaseAuthService` conforms to `AuthService` protocol:
- Sign in with Apple nonce flow: generate nonce -> ASAuthorizationController -> exchange ID token via `supabase.auth.signInWithIdToken()`
- Session restore on launch: `supabase.auth.session`
- Sign out: `supabase.auth.signOut()`
- Save user's full name on first sign-in (Apple only provides once)

See `thoughts/swiftui-architecture-research.md` Section 2 for the complete Sign in with Apple + Supabase code.

`SignInView`: SignInWithAppleButton + app marketing content.

### Task 2.4: Supabase Analysis Service
**Depends on:** Task 2.2 (edge function exists)
**Produces:** `Services/Implementations/SupabaseAnalysisService.swift`

Conforms to `GroceryAnalysisService` protocol. Calls edge function via `supabase.functions.invoke()`.

Handle 403 scan_limit_reached by throwing a typed error that the UI can catch to present the paywall.

### Task 2.5: Integration + Cleanup
**Depends on:** Tasks 2.3, 2.4
**Produces:** Updates to `ServiceEnvironmentKeys.swift`, `ContentView.swift`, `SettingsView.swift`

- Swap default `GroceryAnalysisService` to `SupabaseAnalysisService`
- Add `AuthService` environment key -> `SupabaseAuthService`
- ContentView: route to SignInView when not authenticated
- Settings: remove API Key section, add Account section (email, sign out button)
- Delete: `DirectAnthropicService.swift`, `ApiKeyInputView.swift`, KeychainHelper (API key parts)
- Show remaining free scans on upload screen

---

## Phase 3: Subscriptions + App Store

**Depends on:** Phase 2 complete

### Task 3.1: App Store Connect Setup
**Depends on:** Apple Developer Program enrollment ($99/year)
**Produces:** Subscription products in App Store Connect

- Enroll in Small Business Program
- Create subscription group "Pro Access"
- Create products:
  - `com.aislelist.pro.monthly` -- $4.99/month
  - `com.aislelist.pro.annual` -- $39.99/year
- Optional: 7-day free trial on monthly
- Enable Billing Grace Period (6 days)

### Task 3.2: StoreKit Implementation
**Depends on:** Task 3.1
**Produces:** `Services/Implementations/StoreKitSubscriptionService.swift`, `Resources/Products.storekit`

Create local StoreKit configuration file for Xcode testing.

`StoreKitSubscriptionService` conforms to `SubscriptionService`:
- Load products: `Product.products(for: [monthlyID, annualID])`
- Purchase: `product.purchase(options: [.appAccountToken(supabaseUserId)])` -- links to Supabase user
- Check entitlement: iterate `Transaction.currentEntitlements`
- Listen: `Transaction.updates` async sequence (started at init)
- Restore: `AppStore.sync()`

See `thoughts/storekit2-research.md` for full implementation details and code examples.

### Task 3.3: Paywall UI
**Depends on:** Task 3.2
**Produces:** `Views/Paywall/PaywallView.swift`

Uses `SubscriptionStoreView` (Apple's built-in paywall):
- Marketing header (icon, title, feature list)
- `.subscriptionStoreButtonLabel(.multiline)`
- `.subscriptionStoreControlStyle(.prominentPicker)`
- `.storeButton(.visible, for: .restorePurchases)`
- Presented as `.sheet` when free tier exhausted or from settings

### Task 3.4: Apple Webhook
**Depends on:** Task 2.1 (Supabase schema)
**Produces:** `supabase/functions/apple-webhook/index.ts`

Receives App Store Server Notifications v2:
- Decode JWS `signedPayload`
- Extract `appAccountToken` (Supabase user ID), `productId`, `expiresDate`
- Map notification types to subscription status (active, grace_period, expired, revoked)
- Upsert `subscriptions` table keyed on `original_transaction_id`
- Configure webhook URL in App Store Connect

### Task 3.5: Usage Gating Integration
**Depends on:** Tasks 3.2, 3.4
**Produces:** Updates to `AppViewModel.swift`, `ImageUploadView.swift`

Before scan:
1. Check `subscriptionService.isSubscribed` -- if true, proceed
2. Check `subscriptionService.remainingFreeScans` -- if > 0, proceed
3. If neither, present paywall

Show remaining scans badge on upload screen for free users.

### Task 3.6: App Store Submission
**Depends on:** All Phase 3 tasks
**Produces:** App Store listing, TestFlight build

- App icon (1024x1024 in Assets.xcassets)
- Launch screen
- Screenshots (6.7" and 6.1" iPhone)
- Privacy nutrition labels: camera, photos, Sign in with Apple, usage data
- TestFlight internal beta -> external beta -> production submission

---

## Phase 4: Polish + Growth

Each task is independent:

### Task 4.1: Haptic Feedback
Add `UIImpactFeedbackGenerator` (light) on item check, `UINotificationFeedbackGenerator` (success) on 100% completion.

### Task 4.2: Push Notifications
APNs for reminding users of incomplete lists. Requires notification permission prompt and server-side scheduling.

### Task 4.3: Home Screen Widget
WidgetKit showing current list progress (items checked / total). Uses AppIntents + SwiftData.

### Task 4.4: Share Lists
UIActivityViewController for text/link sharing. CloudKit sharing for family collaboration.

### Task 4.5: ASO
Optimize App Store title, keywords, screenshots, description.

### Task 4.6: Analytics
TelemetryDeck or PostHog for usage patterns (scans per user, completion rates, conversion funnel).

---

## Task Dependency Graph

```
Phase 1 (parallel where possible):
  1.1 Project Setup ----+
  1.2 Models -----------+---> 1.8 Upload Screen ---> 1.13 App ViewModel
  1.3 Store Sections ---+---> 1.10 Grocery List ---/       |
  1.4 Image Preprocess -+---> 1.6 Analysis Service -/      |
  1.5 Keychain/API Key -+                                   |
  1.7 Camera Picker ----+---> 1.8 Upload Screen             |
  1.9 Clarify Screen ---+                                   v
  1.11 History ---------+                          ContentView wiring
  1.12 Settings --------+
  1.14 Network Monitor -+
  1.15 CloudKit Config --+

Phase 2:
  2.1 Supabase Setup ---> 2.2 Edge Function ---> 2.4 Supabase Analysis Service ---> 2.5 Integration
                     \--> 2.3 Auth Service --------------------------------/

Phase 3:
  3.1 ASC Setup ---> 3.2 StoreKit ---> 3.3 Paywall ---> 3.5 Usage Gating ---> 3.6 Submission
                                   \--> 3.4 Webhook ---/

Phase 4: All independent
```

---

## Critical React Source Files

Read these files for the logic that must be ported:

| File | Lines | What to extract |
|------|-------|----------------|
| `src/components/GroceryList.tsx` | 804 | Grouping, sorting, settling, sanity check UI, inline editing, progress ring |
| `src/App.tsx` | 418 | State machine, session creation, sanity check orchestration |
| `src/lib/store-sections.ts` | 338 | All keywords, section order, color mappings, categorizeItem() |
| `src/components/ImageUpload.tsx` | 305 | Upload flow, image preview, recent sessions |
| `src/lib/anthropic-client.ts` | 226 | Exact prompts, tool definitions, response parsing |
| `src/lib/storage.ts` | 264 | Session name generation logic (rest replaced by SwiftData) |
| `src/lib/image-processing.ts` | 128 | Preprocessing constants and algorithm |
| `src/components/ClarifyScreen.tsx` | 130 | Section selection UI, type badges |
| `src/components/HistoryPanel.tsx` | 180 | History display, session loading |
