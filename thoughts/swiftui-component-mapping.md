# React to SwiftUI Component Mapping

Complete analysis of every file in the React codebase with SwiftUI migration equivalents.

---

## Overall App Architecture

### State Machine

The app uses a simple linear state machine managed in `App.tsx`:

```
api_key -> upload -> clarify -> list
```

In React, this is an `AppState` string union rendered via conditional `if` blocks. Each state renders a different top-level component.

### SwiftUI Navigation Equivalent

Use a `NavigationStack` with a path-based approach or an enum-driven container view:

```swift
enum AppScreen: Hashable {
    case apiKey
    case upload
    case clarify(sections: [GrocerySection])
    case list(sessionId: String)
}

// In the native iOS app, the "api_key" screen is replaced by onboarding
// or a settings screen (API key is not needed if using server-side AI calls).
// The primary flow becomes: upload -> clarify -> list
```

**Recommended pattern:** Use `@Observable` view model + `switch` on enum in the body, or `NavigationStack` with `navigationDestination`. Since screens represent a linear flow (not a deep hierarchy), a simple `switch` in a container view works well. `NavigationStack` is better if you want back-swipe gestures for free.

### Data Flow Summary

```
App (owns all state)
  |-- ApiKeyInput       (receives: onSave callback)
  |-- ImageUpload       (receives: onUpload, isLoading, session list)
  |-- ClarifyScreen     (receives: sections[], onConfirm, onBack)
  |-- GroceryList       (receives: items[], onUpdateItems, many callbacks)
  |-- HistoryPanel      (receives: sessions[], CRUD callbacks)
  |-- OfflineBanner     (receives: isOnline)
```

All state lives in `App.tsx` and is passed down as props. In SwiftUI, this maps to a single `@Observable` class (the app's view model) injected via `.environment()` or passed explicitly.

---

## Data Models (Swift Structs)

Source: `/Users/nicholasstrayer/dev/ai/kroger-list/src/lib/types.ts`

### TypeScript Types -> Swift Structs

```swift
// GrocerySection -- returned by AI image analysis
struct GrocerySection: Identifiable, Codable, Hashable {
    let id: UUID  // not in TS version; generate for SwiftUI List identity
    var name: String
    var type: SectionType
    var items: [String]

    enum SectionType: String, Codable, CaseIterable {
        case grocery
        case mealPlan = "meal_plan"
        case crossedOut = "crossed_out"
        case notes
    }
}

// GroceryItem -- individual item in the final list
struct GroceryItem: Identifiable, Codable, Hashable {
    let id: String
    var name: String
    var category: String
    var checked: Bool
}

// ListSession -- a saved shopping list session
struct ListSession: Identifiable, Codable {
    let id: String
    var name: String
    var items: [GroceryItem]
    var createdAt: Date
    var updatedAt: Date
    var hasImage: Bool
}

// SessionIndexEntry -- lightweight summary for history list
struct SessionIndexEntry: Identifiable, Codable {
    let id: String
    var name: String
    var createdAt: Date
    var itemCount: Int
    var checkedCount: Int
    var hasImage: Bool
}

// CategorySuggestion -- AI-proposed category corrections
struct CategorySuggestion: Identifiable, Codable {
    let id: String
    var name: String
    var from: String
    var to: String
}
```

**Migration notes:**
- TypeScript uses `number` timestamps (milliseconds since epoch). Swift should use `Date` and handle encoding via `dateEncodingStrategy`.
- The React app generates IDs with `Date.now().toString()`. In Swift, prefer `UUID().uuidString`.
- If using SwiftData instead of manual persistence, these become `@Model` classes instead of structs.

---

## File-by-File Analysis

---

### `src/App.tsx` -- Main App Container

**What it does:** Root component containing all application state. Implements the screen state machine, session management, API call orchestration, and the AI sanity-check flow.

**Key state and logic:**
- `appState: AppState` -- controls which screen is shown
- `apiKey`, `items`, `sections`, `uploadedImage` -- core data
- `currentSessionId`, `sessionsIndex`, `sessionName` -- session tracking
- `isSanityChecking`, `pendingSuggestions`, `sanityCheckError` -- AI refinement state
- `lastCheckedFingerprint` + `itemsChangedSinceCheck` -- tracks whether items changed since last AI check
- `useEffect` on mount: loads API key, migrates legacy storage, restores current session
- `useEffect` on items change: auto-saves to current session
- Multiple handler functions passed as callbacks to child components

**SwiftUI equivalent:**

```swift
@Observable
class AppViewModel {
    var appScreen: AppScreen = .upload
    var items: [GroceryItem] = []
    var sections: [GrocerySection] = []
    var uploadedImageData: Data? = nil
    var currentSessionId: String? = nil
    var sessionsIndex: [SessionIndexEntry] = []
    var sessionName: String = ""
    var isLoading: Bool = false
    var error: String? = nil

    // AI sanity check
    var isSanityChecking: Bool = false
    var pendingSuggestions: [CategorySuggestion]? = nil
    var sanityCheckError: String? = nil
    private var lastCheckedFingerprint: String? = nil

    // Computed
    var itemsChangedSinceCheck: Bool { ... }

    // Methods replace handler functions
    func handleImageUpload(imageData: Data) async { ... }
    func handleConfirmSections(_ selected: [GrocerySection]) async { ... }
    func runSanityCheck() async { ... }
    func handleNewList() { ... }
    func loadSession(_ id: String) { ... }
    // etc.
}
```

The root view becomes:

```swift
struct ContentView: View {
    @State private var viewModel = AppViewModel()

    var body: some View {
        switch viewModel.appScreen {
        case .upload:
            ImageUploadView()
        case .clarify(let sections):
            ClarifyScreenView(sections: sections)
        case .list:
            GroceryListView()
        }
    }
}
```

**Migration notes:**
- The `useEffect` for auto-saving items maps to a `didSet` observer on items in the view model, or an `.onChange(of:)` modifier.
- The mount-time session restoration maps to an `.onAppear` or `.task` modifier, or the view model's `init()`.
- `sanityCheckSessionRef` (used to discard stale async results) maps to Swift `Task` cancellation -- store the `Task` reference and cancel it when switching sessions.
- The fingerprint logic for detecting item changes can use a computed property.
- The `api_key` screen is likely unnecessary in native iOS (use server-side proxy or Keychain storage for the key).

---

### `src/components/ApiKeyInput.tsx` -- API Key Entry Form

**What it does:** Renders a centered card with a password input for the Anthropic API key, a submit button, and explanatory text about how the app works.

**Key state and logic:**
- Local `apiKey` string state
- Form submit handler that trims and passes key to parent

**SwiftUI equivalent:**
```swift
struct ApiKeyInputView: View {
    @State private var apiKey = ""
    var onSave: (String) -> Void

    var body: some View {
        Form {
            SecureField("API Key", text: $apiKey)
            Button("Save & Continue") { onSave(apiKey.trimmingCharacters(in: .whitespaces)) }
                .disabled(apiKey.trimmingCharacters(in: .whitespaces).isEmpty)
        }
    }
}
```

**Migration notes:**
- This screen may be eliminated entirely in the native app if using a server-side API proxy. If kept, use `SecureField` for the password input.
- The "how it works" instructions block maps to a simple `Section` in a `Form` or a custom info card.
- In native iOS, use Keychain (via `KeychainAccess` or raw Security framework) instead of localStorage.

---

### `src/components/AnimatedTitle.tsx` -- Rough Notation Animated Title

**What it does:** Renders "AIsley List" with a rough-notation underline animation on the "AI" portion using the `rough-notation` library.

**Key state and logic:**
- `useRef` to target the `<span>` element
- `useEffect` on mount to create and show the annotation

**SwiftUI equivalent:**
- No direct equivalent of rough-notation in SwiftUI. Options:
  1. Simple approach: Use `Text("AI").underline()` with a custom animation
  2. Rich approach: Use a custom `Shape` or `Canvas` to draw a hand-drawn-style underline
  3. Skip the animation entirely and use a styled `Text` view

```swift
struct AnimatedTitleView: View {
    var body: some View {
        HStack(spacing: 0) {
            Text("AI")
                .fontWeight(.bold)
                .underline(color: .green)
            Text("sle List")
        }
        .font(.title)
    }
}
```

**Migration notes:**
- The `rough-notation` library has no iOS equivalent. Consider whether this branding detail justifies a custom Canvas drawing or if a simpler underline suffices.
- If you want the hand-drawn aesthetic, look into PencilKit or a custom SwiftUI `Shape` with randomized control points.

---

### `src/components/ClarifyScreen.tsx` -- Section Selection UI

**What it does:** After AI analyzes the image, this screen shows the identified sections (grocery, meal_plan, crossed_out, notes) with checkboxes. User selects which sections to include, then confirms.

**Key state and logic:**
- `selected: Record<number, boolean>` -- tracks which sections are checked (defaults: grocery=on, crossed_out=off)
- `toggleSection(index)` -- toggles a section
- `handleConfirm()` -- filters to selected sections and calls parent callback
- Type badges with color coding per section type
- Shows first 5 items as preview, "+N more" for overflow

**SwiftUI equivalent:**
```swift
struct ClarifyScreenView: View {
    let sections: [GrocerySection]
    var onConfirm: ([GrocerySection]) -> Void
    var onBack: () -> Void

    @State private var selected: Set<GrocerySection.ID>

    init(sections: [GrocerySection], ...) {
        self.sections = sections
        // Default selection: everything except crossed_out
        _selected = State(initialValue: Set(
            sections.filter { $0.type != .crossedOut }.map(\.id)
        ))
    }

    var body: some View {
        List(sections) { section in
            SectionRow(section: section, isSelected: selected.contains(section.id))
                .onTapGesture { toggle(section.id) }
        }
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Add Selected") { confirm() }
                    .disabled(selected.isEmpty)
            }
        }
    }
}
```

**Migration notes:**
- The checkbox + card layout maps naturally to a `List` with custom row views, or a `ScrollView` with `ForEach`.
- Type badges (grocery, meal_plan, etc.) map to styled `Text` views with `.background()` capsule shapes.
- The "Upload Different Image" back button maps to a toolbar back button or a `NavigationStack` pop.
- The `ImageThumbnail` in the top-right maps to a toolbar item.

---

### `src/components/DarkModeToggle.tsx` -- Theme Toggle Button

**What it does:** A button that toggles between sun (light mode) and moon (dark mode) SVG icons.

**Key state and logic:**
- Stateless; receives `isDark` and `onToggle` as props
- Renders sun/moon SVG based on `isDark`

**SwiftUI equivalent:**
- On iOS, dark mode is controlled at the system level. A manual toggle uses `preferredColorScheme`:

```swift
struct DarkModeToggle: View {
    @AppStorage("isDarkMode") var isDark = false

    var body: some View {
        Button(action: { isDark.toggle() }) {
            Image(systemName: isDark ? "sun.max.fill" : "moon.fill")
        }
    }
}

// Applied at root:
.preferredColorScheme(isDark ? .dark : .light)
```

**Migration notes:**
- iOS has native dark mode support. Most apps just follow the system setting. A manual toggle is optional.
- `@AppStorage` automatically persists to UserDefaults (equivalent to localStorage).
- SF Symbols (`sun.max.fill`, `moon.fill`) replace the inline SVGs.

---

### `src/components/GroceryList.tsx` -- Main Checklist View (804 lines)

**What it does:** The primary screen showing all grocery items grouped by store section. This is the most complex component. Features include:
- Progress ring showing % complete
- Editable session name
- Items grouped by category with colored section headers
- Checkbox toggle with bounce animation
- Inline item name editing (tap to edit)
- Swipe-to-delete on mobile, X button on desktop
- Long-press / right-click to open a category picker portal
- FLIP animation for items reordering when checked/unchecked
- AI sanity check banner (loading, suggestions, error)
- Re-categorize button
- Mobile hamburger menu vs desktop button bar
- "Add item" button at the bottom

**Key state and logic:**
- `editingItem`, `editingValue` -- inline text editing for item names
- `editingName`, `nameValue` -- session name editing
- `suggestionsExpanded` -- toggle for AI suggestion details
- `animatingCheckbox` -- tracks which checkbox is bouncing
- `menuOpen` -- mobile hamburger menu state
- `recategorizingItem`, `pickerPosition`, `customSection` -- category picker dropdown
- `settlingItems` -- delays reordering animation after check
- FLIP animation via `useLayoutEffect` + `prevPositions` ref
- Long-press detection via `touchStart`/`touchEnd` timers
- Item grouping by category + sorting (unchecked first, checked last)
- Section ordering: known sections in store order, then dynamic, then "Other" last

**SwiftUI equivalent:**

This needs to be broken into several SwiftUI views:

```swift
// Main list view
struct GroceryListView: View {
    @Environment(AppViewModel.self) var viewModel

    var body: some View {
        ScrollView {
            // Header with progress ring + session name
            GroceryListHeader()

            // AI sanity check banners
            SanityCheckBanner()

            // Sections
            ForEach(sortedSections, id: \.self) { section in
                GrocerySectionView(section: section, items: groupedItems[section] ?? [])
            }

            // Add item button
            AddItemButton()
        }
        .toolbar { ... }
    }
}

// Individual item row
struct GroceryItemRow: View {
    let item: GroceryItem

    var body: some View {
        HStack {
            CheckboxView(isChecked: item.checked)
            Text(item.name)
                .strikethrough(item.checked)
            Spacer()
            Text(item.category)
                .font(.caption2)
        }
        .swipeActions(edge: .trailing) {
            Button("Delete", role: .destructive) { delete(item) }
        }
        .contextMenu {
            // Category picker replaces long-press/right-click portal
            ForEach(SECTION_ORDER, id: \.self) { section in
                Button(section) { recategorize(item, to: section) }
            }
        }
    }
}
```

**Migration notes:**
- **FLIP animation:** SwiftUI has built-in `.animation()` and `withAnimation {}` that handle list reordering automatically. The manual FLIP code (`useLayoutEffect`, `getBoundingClientRect`, `requestAnimationFrame`) is entirely unnecessary in SwiftUI. Use `.animation(.easeOut, value: items)` on the list.
- **Settling delay:** The "settling items" pattern (delay reorder after check) maps to a `DispatchQueue.main.asyncAfter` or `Task.sleep` before toggling the item in the sorted array.
- **Category picker (portal):** Replace the `createPortal` dropdown with a `.contextMenu` or a `.sheet` / `.popover`. `contextMenu` is the natural iOS equivalent of long-press.
- **Swipe-to-delete:** SwiftUI `List` has built-in `.swipeActions` or `.onDelete`.
- **Inline editing:** Use a `TextField` that appears on tap, or a `.sheet` with an edit form.
- **Progress ring:** Use a custom `Shape` with `trim(from:to:)` animation, or a `ProgressView(.circular)` with custom styling.
- **Mobile vs desktop layout:** In iOS, there is only one layout. The hamburger menu becomes the native toolbar. Use `.toolbar` with `ToolbarItemGroup`.
- **Section colors:** Map the Tailwind color classes to SwiftUI `Color` values. Store as a dictionary of section name -> Color.
- **Checkbox bounce:** Use `.scaleEffect` with a spring animation.

This is the largest component and should be split into 4-5 smaller SwiftUI views:
1. `GroceryListView` (container with toolbar)
2. `GroceryListHeader` (progress ring + session name)
3. `GrocerySectionView` (section header + item rows)
4. `GroceryItemRow` (single item with checkbox, swipe, context menu)
5. `SanityCheckBanner` (AI suggestion UI)

---

### `src/components/HistoryPanel.tsx` -- Slide-Out History Panel

**What it does:** A slide-out panel from the right showing all saved list sessions. Each session shows name, date, progress bar, and image indicator. Supports inline renaming, swipe-to-delete, and tapping to load.

**Key state and logic:**
- `editingId`, `editName` -- inline rename state
- `handleLoad` -- loads session and closes panel
- `formatDate` -- timestamp formatting
- Renders as a fixed overlay with backdrop + panel

**SwiftUI equivalent:**

```swift
struct HistoryPanelView: View {
    @Environment(AppViewModel.self) var viewModel
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            List(viewModel.sessionsIndex) { session in
                SessionRow(session: session)
                    .swipeActions(edge: .trailing) {
                        Button("Delete", role: .destructive) { viewModel.deleteSession(session.id) }
                    }
                    .onTapGesture { viewModel.loadSession(session.id); dismiss() }
            }
            .navigationTitle("List History")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}
```

**Migration notes:**
- The slide-from-right panel maps to a `.sheet` presentation in SwiftUI, which is the standard iOS pattern. Alternatively, use a `NavigationLink` push.
- The backdrop overlay is handled automatically by `.sheet`.
- Inline rename could use a `.swipeActions` "Rename" button that presents an alert with a text field, or a long-press context menu.
- Progress bar maps to `ProgressView(value:)`.
- Date formatting should use `DateFormatter` or `.formatted()` in Swift.
- Swipe-to-delete is built into `List` with `.onDelete` or `.swipeActions`.

---

### `src/components/ImageThumbnail.tsx` -- Clickable Thumbnail with Modal

**What it does:** Shows a small thumbnail of the uploaded image. Tapping opens a full-screen modal overlay to view the image at full size.

**Key state and logic:**
- `isModalOpen` -- toggles full-screen view
- Thumbnail: 56x56px rounded image
- Modal: fixed overlay with centered image

**SwiftUI equivalent:**

```swift
struct ImageThumbnail: View {
    let imageData: Data
    @State private var isFullScreen = false

    var body: some View {
        Button { isFullScreen = true } label: {
            Image(uiImage: UIImage(data: imageData)!)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: 56, height: 56)
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .fullScreenCover(isPresented: $isFullScreen) {
            ZoomableImageView(imageData: imageData)
        }
    }
}
```

**Migration notes:**
- The modal maps to `.fullScreenCover` or `.sheet`.
- Consider adding pinch-to-zoom with `MagnificationGesture` for the full-screen view -- this is expected on iOS.
- `UIImage(data:)` handles the image decoding. Store images as `Data` rather than base64 strings in the native app.

---

### `src/components/ImageUpload.tsx` -- Drag-Drop Upload Screen

**What it does:** The main upload screen with drag-and-drop area, file input button, loading spinner, image preview, and a "Continue Previous List" section showing recent sessions.

**Key state and logic:**
- `preview` -- data URL of selected image for preview
- `isDragging` -- drag-over state for visual feedback
- `processFile` -- reads file, preprocesses for API, calls `onUpload`
- Drag handlers: `handleDragOver`, `handleDragLeave`, `handleDrop`
- Recent sessions list (top 3) with progress indicators

**SwiftUI equivalent:**

```swift
struct ImageUploadView: View {
    @Environment(AppViewModel.self) var viewModel
    @State private var selectedImage: UIImage?
    @State private var showCamera = false
    @State private var showPhotoPicker = false

    var body: some View {
        VStack {
            // Upload area
            Button { showPhotoPicker = true } label: {
                UploadPlaceholder()
            }

            // Or take a photo (iOS advantage!)
            Button { showCamera = true } label: {
                Label("Take Photo", systemImage: "camera")
            }

            // Preview
            if let image = selectedImage {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
            }

            // Recent sessions
            if !viewModel.sessionsIndex.isEmpty {
                RecentSessionsList()
            }
        }
        .photosPicker(isPresented: $showPhotoPicker, ...)
        .fullScreenCover(isPresented: $showCamera) {
            CameraView(...)
        }
    }
}
```

**Migration notes:**
- **Drag-and-drop is irrelevant on iOS.** Replace with `PhotosPicker` (iOS 16+) for photo library access and optionally a camera capture view.
- The native app can offer camera capture directly -- a significant UX improvement over the web version.
- Image preprocessing (`image-processing.ts`) maps to `UIImage` resize/compress methods. Use `UIImage.jpegData(compressionQuality:)` and `UIGraphicsImageRenderer` for resizing.
- The "Continue Previous List" section maps to a simple `List` or `VStack` of session buttons.

---

### `src/components/OfflineBanner.tsx` -- PWA Offline Indicator

**What it does:** Shows a fixed yellow banner at the top of the screen when the device is offline.

**Key state and logic:**
- Stateless; receives `isOnline` prop
- Returns null when online

**SwiftUI equivalent:**

```swift
struct OfflineBanner: View {
    @Environment(\.isConnected) var isConnected  // custom environment value
    // OR use NWPathMonitor

    var body: some View {
        if !isConnected {
            Text("You're offline. Your list is saved locally.")
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(Color.yellow)
                .foregroundStyle(.primary)
        }
    }
}
```

**Migration notes:**
- Use `NWPathMonitor` from the `Network` framework to monitor connectivity status.
- The banner can be overlaid on the main view using a `ZStack` or `.safeAreaInset(edge: .top)`.
- iOS apps are inherently more offline-capable than web apps, so this banner may be less critical.

---

### `src/components/SwipeableItem.tsx` -- Swipe-to-Delete Wrapper

**What it does:** A touch-based swipe gesture handler that reveals a red "Delete" button behind the content when swiped left.

**Key state and logic:**
- `translateX`, `isOpen`, `isDraggingState` -- swipe position tracking
- Touch handlers: `handleTouchStart`, `handleTouchMove`, `handleTouchEnd`
- Threshold-based snap: opens if swiped > 40px, closes otherwise
- Tapping when open closes the swipe

**SwiftUI equivalent:**

**This entire component is unnecessary in SwiftUI.** Use built-in List swipe actions:

```swift
List {
    ForEach(items) { item in
        ItemRow(item: item)
            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                Button("Delete", role: .destructive) {
                    deleteItem(item)
                }
            }
    }
}
```

**Migration notes:**
- SwiftUI `List` has native swipe-to-delete via `.swipeActions` (iOS 15+) or `.onDelete` on `ForEach`.
- The 80px threshold, manual touch tracking, and translateX animation are all handled by the system.
- If using `ScrollView` + `LazyVStack` instead of `List`, you would need a custom swipe gesture, but `List` is recommended.

---

### `src/hooks/useDarkMode.ts` -- Dark Mode Hook

**What it does:** Manages dark mode state, persists to localStorage, and toggles the `dark` class on `<html>`.

**Key state and logic:**
- Initializes from localStorage or system preference
- `useEffect` syncs class on `<html>` element
- Returns `{ isDark, toggle }`

**SwiftUI equivalent:**

```swift
// At the app root:
@AppStorage("isDarkMode") var isDark = false

// Apply:
.preferredColorScheme(isDark ? .dark : .light)
```

**Migration notes:**
- `@AppStorage` replaces localStorage for persistence.
- `preferredColorScheme` replaces manual DOM class toggling.
- The system preference check (`prefers-color-scheme: dark`) maps to `UITraitCollection.current.userInterfaceStyle`.
- Most iOS apps just follow the system setting and don't have a manual toggle.

---

### `src/hooks/useOnlineStatus.ts` -- Network Connectivity Hook

**What it does:** Tracks online/offline status using `navigator.onLine` and window events.

**Key state and logic:**
- `useState(navigator.onLine)` -- initial state
- `useEffect` adds `online`/`offline` event listeners

**SwiftUI equivalent:**

```swift
import Network

@Observable
class NetworkMonitor {
    var isConnected = true
    private let monitor = NWPathMonitor()

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
            }
        }
        monitor.start(queue: DispatchQueue(label: "NetworkMonitor"))
    }

    deinit {
        monitor.cancel()
    }
}
```

**Migration notes:**
- `NWPathMonitor` from the `Network` framework is more reliable than web events.
- Can also detect whether the connection is WiFi vs cellular.
- Inject as an environment object for global access.

---

### `src/lib/anthropic-client.ts` -- Anthropic API Integration

**What it does:** Two API functions:
1. `analyzeGroceryImage()` -- sends a base64 image to Claude Sonnet with tool use to extract grocery sections
2. `sanityCheckCategories()` -- sends item/category pairs to Claude Haiku to verify/correct categorizations

**Key logic:**
- Creates an Anthropic client per call (with `dangerouslyAllowBrowser: true`)
- Uses tool_choice forced to specific tool names
- Debug logging to console when `localStorage.debug_api === "true"`
- Parses tool_use response blocks

**SwiftUI equivalent:**

For the native iOS app, there are two architectural options:

**Option A: Direct API calls from device (like the web app):**
```swift
// Use URLSession to call Anthropic API directly
struct AnthropicService {
    let apiKey: String

    func analyzeGroceryImage(imageData: Data) async throws -> [GrocerySection] {
        var request = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        let body: [String: Any] = [
            "model": "claude-sonnet-4-5-20250929",
            "max_tokens": 4096,
            "tools": [toolDefinition],
            "tool_choice": ["type": "tool", "name": "grocery_sections"],
            "messages": [["role": "user", "content": [imageContent, textContent]]]
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, _) = try await URLSession.shared.data(for: request)
        // Parse response...
    }
}
```

**Option B: Server-side proxy (recommended for production):**
```swift
// Call your own backend which proxies to Anthropic
struct APIService {
    func analyzeGroceryImage(imageData: Data) async throws -> [GrocerySection] {
        // POST to your Supabase Edge Function or server endpoint
        // Server holds the API key securely
    }
}
```

**Migration notes:**
- The Anthropic TypeScript SDK does not have an official Swift SDK. Use raw `URLSession` or a third-party HTTP client.
- `dangerouslyAllowBrowser` is a web-specific concern. On iOS, API calls from the device are normal (but still expose the API key in the binary/memory).
- For a production app, a server-side proxy is strongly recommended. The API key stays on the server, and you can add rate limiting, auth, etc.
- Tool use response parsing needs manual JSON decoding in Swift.
- Debug logging maps to `os.Logger` or `print` statements gated by a debug flag.

---

### `src/lib/schemas.ts` -- Zod Validation Schemas

**What it does:** Defines a Zod schema for the grocery section response from the AI.

**Key logic:**
- `grocerySectionSchema` validates the shape of the AI tool response

**SwiftUI equivalent:**

In Swift, use `Codable` structs for parsing. The struct definitions in the Data Models section above serve the same purpose:

```swift
struct AnalyzeResponse: Codable {
    let sections: [GrocerySection]
}
```

**Migration notes:**
- Swift's `Codable` + `JSONDecoder` replaces Zod.
- For runtime validation beyond type conformance, add custom `init(from decoder:)` implementations.
- The schema is primarily used for type safety, which Swift provides natively.

---

### `src/lib/storage.ts` -- Session Persistence (localStorage)

**What it does:** CRUD operations for grocery list sessions stored in localStorage. Handles:
- Session index (lightweight list of all sessions)
- Individual session data (items)
- Session images (compressed thumbnails)
- Image compression (resize to 400px, JPEG at 0.7 quality)
- Session name generation (weekday + date)
- Legacy storage migration

**Key functions:**
- `loadSessionsIndex()`, `saveSessionsIndex()`
- `loadSession()`, `saveSession()`, `deleteSession()`, `updateSession()`
- `loadSessionImage()`, `saveSessionImage()`
- `compressImage()` -- canvas-based image resize
- `generateSessionName()` -- date-based name with duplicate suffix
- `createSession()` -- creates session + compresses/saves image
- `migrateFromLegacyStorage()` -- one-time migration from old format

**SwiftUI equivalent:**

For a native iOS app, the storage layer depends on the chosen persistence strategy:

**Option A: SwiftData (recommended for iOS 17+):**
```swift
@Model
class GrocerySession {
    var name: String
    var items: [GroceryItem]  // stored as Codable
    var createdAt: Date
    var updatedAt: Date
    @Attribute(.externalStorage) var thumbnailData: Data?

    // SwiftData handles CRUD automatically
}
```

**Option B: FileManager + JSON files:**
```swift
class SessionStorage {
    private let documentsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]

    func saveSession(_ session: ListSession) throws {
        let data = try JSONEncoder().encode(session)
        try data.write(to: documentsDir.appendingPathComponent("session_\(session.id).json"))
    }

    func loadSession(_ id: String) throws -> ListSession? {
        let url = documentsDir.appendingPathComponent("session_\(id).json")
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(ListSession.self, from: data)
    }
}
```

**Option C: Supabase (for cloud sync):**
```swift
// Use Supabase Swift SDK for remote persistence
// Local cache via SwiftData, sync via Supabase realtime
```

**Migration notes:**
- `localStorage` has a ~5-10MB limit. iOS file storage has no practical limit.
- Image compression (`compressImage`) maps to `UIImage.jpegData(compressionQuality:)` and `UIGraphicsImageRenderer` for resizing. Much simpler than canvas manipulation.
- Session name generation logic transfers directly -- use `DateFormatter` with matching format.
- The legacy migration code can be dropped entirely for the native app.
- If using SwiftData, most CRUD code disappears -- SwiftData handles persistence automatically.
- The sessions index pattern (lightweight summaries separate from full data) may be unnecessary with SwiftData, which supports lazy loading and fetch descriptors.

---

### `src/lib/store-sections.ts` -- Store Section Mapping & Categorization

**What it does:** Defines the store section taxonomy, keyword-to-section mapping, section ordering, and section color theming.

**Key data:**
- `STORE_SECTIONS: Record<string, string[]>` -- maps section names to keyword arrays (e.g., "Produce" -> ["lettuce", "tomato", ...])
- `SECTION_ORDER: string[]` -- ordered list of sections as they appear in a Kroger store
- `SECTION_COLORS` -- maps sections to Tailwind CSS class sets for light/dark mode
- `DYNAMIC_SECTION_COLORS` -- additional color palette for AI-proposed custom sections
- `getSectionColors()` -- returns colors for a section (known or dynamic with hash-based selection)
- `categorizeItem(name)` -- keyword matching to assign a section (falls back to "Other")

**SwiftUI equivalent:**

```swift
struct StoreSection {
    let name: String
    let keywords: [String]
    let color: Color
    let darkColor: Color
}

enum StoreSections {
    static let all: [StoreSection] = [
        StoreSection(name: "Produce", keywords: ["lettuce", "tomato", ...], color: .green, darkColor: .green.opacity(0.3)),
        StoreSection(name: "Meat & Seafood", keywords: ["chicken", "beef", ...], color: .red, darkColor: .red.opacity(0.3)),
        // ...
    ]

    static let order: [String] = ["Produce", "Bakery", "Meat & Seafood", ...]

    static func categorize(_ itemName: String) -> String {
        let lower = itemName.lowercased()
        for section in all where section.name != "Other" {
            if section.keywords.contains(where: { lower.contains($0) }) {
                return section.name
            }
        }
        return "Other"
    }

    static func color(for section: String) -> Color {
        all.first(where: { $0.name == section })?.color ?? .gray
    }
}
```

**Migration notes:**
- Tailwind CSS color classes map to SwiftUI `Color` values. E.g., `bg-emerald-100` -> `Color.green.opacity(0.15)`, or use custom hex colors for exact matching.
- The hash-based dynamic color selection for unknown sections transfers directly to Swift.
- The keyword matching algorithm is the same -- just string operations.
- Consider using an `enum` for known sections and a separate mechanism for dynamic sections.

---

### `src/lib/image-processing.ts` -- API Image Preprocessing

**What it does:** Resizes and compresses images before sending to the Anthropic API. Handles:
- Dimension scaling (longest edge <= 1568px)
- JPEG compression with progressive quality reduction
- Fallback to smaller dimensions (1092px) if still over 5MB
- Base64 size calculation without decoding

**Key functions:**
- `calculateDimensions()` -- proportional scaling
- `base64ByteSize()` -- padding-aware size estimation
- `resizeImageOnCanvas()` -- OffscreenCanvas resize + JPEG encode
- `preprocessImageForApi()` -- orchestrates the pipeline

**SwiftUI equivalent:**

```swift
struct ImagePreprocessor {
    static let maxLongestEdge: CGFloat = 1568
    static let maxBytes = 5 * 1024 * 1024
    static let initialQuality: CGFloat = 0.85
    static let minQuality: CGFloat = 0.4
    static let qualityStep: CGFloat = 0.1
    static let fallbackLongestEdge: CGFloat = 1092

    static func preprocess(_ image: UIImage) -> Data {
        var resized = resize(image, maxEdge: maxLongestEdge)
        var quality = initialQuality
        var data = resized.jpegData(compressionQuality: quality)!

        while data.count > maxBytes && quality > minQuality {
            quality -= qualityStep
            data = resized.jpegData(compressionQuality: max(quality, minQuality))!
        }

        if data.count > maxBytes {
            resized = resize(image, maxEdge: fallbackLongestEdge)
            data = resized.jpegData(compressionQuality: minQuality)!
        }

        return data
    }

    static func resize(_ image: UIImage, maxEdge: CGFloat) -> UIImage {
        let longestEdge = max(image.size.width, image.size.height)
        guard longestEdge > maxEdge else { return image }

        let scale = maxEdge / longestEdge
        let newSize = CGSize(
            width: image.size.width * scale,
            height: image.size.height * scale
        )

        let renderer = UIGraphicsImageRenderer(size: newSize)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
    }
}
```

**Migration notes:**
- `OffscreenCanvas` + `convertToBlob` maps to `UIGraphicsImageRenderer` + `jpegData()`.
- No base64 encoding needed on iOS -- send raw `Data` or encode with `data.base64EncodedString()`.
- `UIImage` handles image loading from `Data`, `PHPickerResult`, or camera capture.
- The progressive quality reduction algorithm transfers directly.

---

### `src/index.css` -- Tailwind CSS + Custom Animations

**What it does:** Global styles including Tailwind v4 config, dark mode variables, and custom CSS animations.

**Key CSS:**
- `@custom-variant dark` -- Tailwind v4 dark mode setup
- CSS variables for background/foreground colors
- `checkbox-bounce` keyframe animation
- `progress-ring-circle` transition
- `interactive-press` scale-on-active effect
- `dark-gradient-bg` dark mode gradient
- `card-depth` glassmorphism effect
- `celebrate` animation for 100% completion
- `item-flip` transition for reorder animation

**SwiftUI equivalent:**

All of these map to SwiftUI animation APIs:

```swift
// Checkbox bounce
withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
    scale = 1.0
}

// Progress ring
Circle()
    .trim(from: 0, to: progress)
    .stroke(lineWidth: 6)
    .animation(.easeOut(duration: 0.5), value: progress)

// Interactive press
.scaleEffect(isPressed ? 0.97 : 1.0)

// Card depth (glassmorphism)
.background(.ultraThinMaterial)

// Celebrate animation
.rotationEffect(.degrees(isComplete ? 3 : 0))
.scaleEffect(isComplete ? 1.1 : 1.0)
.animation(.spring(), value: isComplete)

// Item reorder
.animation(.easeOut(duration: 0.3), value: items)
```

**Migration notes:**
- SwiftUI's animation system is declarative and handles most transitions automatically.
- `@keyframes` CSS animations map to SwiftUI `.animation()` modifiers with spring/easeOut curves.
- Dark mode is handled by the system -- no CSS variables needed.
- The glassmorphism `card-depth` effect maps to `.background(.ultraThinMaterial)`.
- List item reordering animation is automatic when using `ForEach` with identified data and `withAnimation`.

---

## Navigation Structure Summary

```
App (root)
  |
  |-- NavigationStack or switch-based container
  |     |
  |     |-- ImageUploadView
  |     |     |-- PhotosPicker / Camera
  |     |     |-- RecentSessionsList
  |     |
  |     |-- ClarifyScreenView
  |     |     |-- Section toggle cards
  |     |
  |     |-- GroceryListView
  |           |-- GroceryListHeader (progress ring, session name)
  |           |-- SanityCheckBanner
  |           |-- ForEach sections
  |           |     |-- GrocerySectionView
  |           |           |-- ForEach items
  |           |                 |-- GroceryItemRow
  |           |-- AddItemButton
  |
  |-- .sheet: HistoryPanelView
  |-- .fullScreenCover: ImageFullScreenView
  |-- .contextMenu: CategoryPicker (on items)
  |-- .alert: Error messages
```

---

## Key Architectural Differences Summary

| React Pattern | SwiftUI Equivalent |
|---|---|
| `useState` | `@State`, `@Binding` |
| `useEffect` (mount) | `.onAppear`, `.task` |
| `useEffect` (dependency) | `.onChange(of:)`, `didSet` |
| `useRef` | `@State` (non-rendered), stored properties |
| `useCallback` | Regular methods (no memoization needed) |
| `useLayoutEffect` | Not needed (animations are declarative) |
| Conditional rendering (`if/else` JSX) | `if/else` in `body`, `switch` |
| `createPortal` | `.sheet`, `.popover`, `.fullScreenCover`, `.overlay` |
| Props drilling | `@Environment`, direct parameters |
| `localStorage` | `@AppStorage`, `UserDefaults`, SwiftData, FileManager |
| CSS classes / Tailwind | ViewModifiers, custom styles |
| SVG icons | SF Symbols (`Image(systemName:)`) |
| `navigator.onLine` | `NWPathMonitor` |
| `window.matchMedia` | `UITraitCollection`, `@Environment(\.colorScheme)` |
| `FileReader` / `<input type="file">` | `PhotosPicker`, `UIImagePickerController` |
| Canvas image manipulation | `UIGraphicsImageRenderer`, `UIImage` |
| CSS `@keyframes` | `withAnimation`, `.animation()`, `Animation.spring()` |
| `rough-notation` library | Custom `Shape` or simple `.underline()` |
| Drag-and-drop upload | Not applicable on iOS (use photo picker / camera) |
| Touch event handlers | SwiftUI gestures (`DragGesture`, `LongPressGesture`) |
| `className` conditional strings | ViewModifiers + conditional logic |
| `React.FormEvent` | Not needed (SwiftUI bindings) |
