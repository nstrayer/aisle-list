# iOS App Structure (AIsleList/)

## Directory Layout

```
AIsleList/
  AIsleListApp.swift         # @main entry, explicit ModelContainer init
  ContentView.swift          # Root view, NavigationStack, route-based navigation
  project.yml                # xcodegen config (generates .xcodeproj)
  Models/
    ListSession.swift        # @Model - session with items, thumbnail
    GroceryItem.swift        # @Model - individual grocery item
    GrocerySection.swift     # Codable struct for AI response (not SwiftData)
    CategorySuggestion.swift # Codable struct for sanity check results
    Route.swift              # Navigation enum: apiKey, upload, clarify, list
  Views/
    ApiKey/
      ApiKeyInputView.swift  # SecureField for API key entry (temporary, Phase 1 only)
    Upload/
      ImageUploadView.swift  # Camera/photo picker, recent lists, analysis trigger
      CameraPicker.swift     # UIImagePickerController wrapper
    Clarify/
      ClarifyView.swift      # Section selection with toggles
      SectionCard.swift      # Individual section display with type badge
    List/
      GroceryListView.swift  # Main checklist, grouped by store section
      GroceryListHeader.swift # Progress ring, session name, item count
      GrocerySectionView.swift # Section header + item list
      GroceryItemRow.swift   # Item row with check, edit, swipe delete, context menu
      SanityCheckBanner.swift # AI re-categorization suggestions UI
      AddItemButton.swift    # Dashed outline "add item" button
    History/
      HistoryView.swift      # Sheet with session list, swipe actions
      SessionRow.swift       # Individual session in history
    Settings/
      SettingsView.swift     # Dark mode, API key management, about
  ViewModels/
    AppViewModel.swift       # @Observable state machine (mirrors React App.tsx)
  Services/
    Protocols/
      GroceryAnalysisService.swift  # Protocol: analyzeImage, sanityCheckCategories
    Implementations/
      DirectAnthropicService.swift  # BYOK: raw URLSession to Anthropic API
    Environment/
      ServiceEnvironmentKeys.swift  # SwiftUI environment injection
  Utilities/
    StoreSections.swift      # 12 store sections, keyword matching, colors
    ImagePreprocessor.swift  # Resize/compress for API + thumbnails
    KeychainHelper.swift     # Save/load/delete from iOS Keychain
    NetworkMonitor.swift     # NWPathMonitor wrapper, @Observable
  Resources/
    Info.plist               # Bundle config, camera/photo usage, portrait-only, launch screen
    AIsleList.entitlements   # Empty (CloudKit removed until container created)
    XCODE_SETUP.md           # Setup instructions for Xcode project
```

## Build System

- Uses **xcodegen** with `project.yml` to generate `AIsleList.xcodeproj`
- After adding or removing Swift files: `cd AIsleList && xcodegen generate`
- iOS 17.0+ deployment target, Swift 5.10+
- Bundle ID: `com.aislelist.app`
- Dev team: `RKFCF9LE9G`

## Navigation Pattern

Enum-based routing via `Route`:
- `.apiKey` -- show API key input
- `.upload` -- show image upload/camera
- `.clarify([GrocerySection])` -- show section selection
- `.list(ListSession)` -- show grocery checklist

`AppViewModel` is an `@Observable` class that manages `currentRoute` and orchestrates the flow between screens.

## Data Layer

- **SwiftData** `@Model` classes: `ListSession`, `GroceryItem`
- `ListSession` has `@Relationship(deleteRule: .cascade)` to `[GroceryItem]`
- Thumbnails stored as `@Attribute(.externalStorage) var thumbnailData: Data?`
- `ModelContainer` created explicitly in `AIsleListApp.init()` with `fatalError` on failure
