# iOS App Structure (AIsleList/)

## Directory Layout

```
AIsleList/
  AIsleListApp.swift         # @main entry, ModelContainer init, auth/analysis service setup
  ContentView.swift          # Root view, dual-mode routing (auth vs BYOK)
  project.yml                # xcodegen config (generates .xcodeproj), Supabase Swift dependency
  Models/
    ListSession.swift        # @Model - session with items, thumbnail
    GroceryItem.swift        # @Model - individual grocery item
    GrocerySection.swift     # Codable struct for AI response (not SwiftData)
    CategorySuggestion.swift # Codable struct for sanity check results
    Route.swift              # Navigation enum: apiKey, upload, clarify, list
  Views/
    Auth/
      SignInView.swift        # Sign in with Apple UI, nonce generation, SHA256 hashing
    ApiKey/
      ApiKeyInputView.swift  # SecureField for API key entry (BYOK fallback only)
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
      SettingsView.swift     # Dark mode, dual-mode (Account sign-out for auth / API key mgmt for BYOK), about
  ViewModels/
    AppViewModel.swift       # @Observable state machine (mirrors React App.tsx)
  Services/
    Protocols/
      GroceryAnalysisService.swift  # Protocol: analyzeImage, sanityCheckCategories
      AuthService.swift             # Protocol: AuthState enum, signInWithApple, restoreSession, signOut
    Implementations/
      DirectAnthropicService.swift  # BYOK: raw URLSession to Anthropic API
      SupabaseAuthService.swift     # Failable init?(urlString:anonKey:), private baseURL + anonKey, Sign in with Apple via Supabase, stored accessToken (set on sign-in/restore/sign-out), exposes supabaseClient (read-only)
      SupabaseAnalysisService.swift # Calls edge function via Supabase SDK client.functions.invoke(), takes SupabaseClient directly, handles scan limit errors
    Environment/
      ServiceEnvironmentKeys.swift  # SwiftUI environment injection (analysisService + authService)
  Utilities/
    StoreSections.swift      # 12 store sections, keyword matching, colors
    ImagePreprocessor.swift  # Resize/compress for API + thumbnails
    KeychainHelper.swift     # Save/load/delete from iOS Keychain
    NetworkMonitor.swift     # NWPathMonitor wrapper, @Observable
  Resources/
    Info.plist               # Bundle config, camera/photo usage, portrait-only, launch screen, optional SUPABASE_URL/SUPABASE_ANON_KEY
    AIsleList.entitlements   # Sign in with Apple entitlement (CloudKit removed until container created)
    XCODE_SETUP.md           # Setup instructions for Xcode project
```

## Build System

- Uses **xcodegen** with `project.yml` to generate `AIsleList.xcodeproj`
- After adding or removing Swift files: `cd AIsleList && xcodegen generate`
- iOS 17.0+ deployment target, Swift 5.10+
- Bundle ID: `com.aislelist.app`
- Dev team: `RKFCF9LE9G`
- **Dependencies**: Supabase Swift SDK (`supabase-swift` >= 2.0.0) via SPM

## Navigation Pattern

Enum-based routing via `Route`:
- `.apiKey` -- show API key input (BYOK mode only)
- `.upload` -- show image upload/camera
- `.clarify([GrocerySection])` -- show section selection
- `.list(ListSession)` -- show grocery checklist

`ContentView` has a dual-mode architecture:
- **Auth mode** (Supabase configured): `authModeContent` checks `AuthState` -- shows `SignInView` when signed out, `appContent` when signed in. On appear, navigates from `.apiKey` to `.upload` (auth gate handles sign-in).
- **BYOK mode** (no Supabase): `byokModeContent` shows `ApiKeyInputView` for `.apiKey` route, then `appContent`. On appear, auto-navigates to `.upload` if saved key exists.
- **Shared `appContent`**: the upload/clarify/list flow, used by both modes

Service resolution: `resolveAnalysisService()` prefers injected `SupabaseAnalysisService` (via environment), falls back to `DirectAnthropicService` (BYOK via Keychain).

Mode detection: `AIsleListApp.setupServices()` tries `SupabaseAuthService(urlString:anonKey:)` with values from Info.plist. If init returns nil (missing/invalid URL or empty anon key), services stay nil and BYOK mode activates.

`AppViewModel` is an `@Observable` class that manages `currentRoute` and orchestrates the flow between screens.

## Data Layer

- **SwiftData** `@Model` classes: `ListSession`, `GroceryItem`
- `ListSession` has `@Relationship(deleteRule: .cascade)` to `[GroceryItem]`
- Thumbnails stored as `@Attribute(.externalStorage) var thumbnailData: Data?`
- `ModelContainer` created explicitly in `AIsleListApp.init()` with `fatalError` on failure
