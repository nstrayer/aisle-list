# SwiftUI Architecture & Supabase Swift SDK Research

Research compiled for the grocery list app migration from React to native iOS.

---

## 1. Modern SwiftUI Architecture (2025/2026)

### @Observable vs ObservableObject

The `@Observable` macro (Observation framework, iOS 17+) replaces the older `ObservableObject` / `@Published` pattern.

**Old pattern (ObservableObject):**
```swift
final class CounterViewModel: ObservableObject {
    @Published private(set) var count: Int = 0
    @Published private(set) var name: String = ""

    func increment() { count += 1 }
}

struct CounterView: View {
    @ObservedObject var viewModel: CounterViewModel
    // OR @StateObject for ownership

    var body: some View {
        Text("\(viewModel.count)")  // Redraws when ANY @Published changes
    }
}
```

**New pattern (@Observable):**
```swift
import Observation

@Observable
final class CounterViewModel {
    private(set) var count: Int = 0
    private(set) var name: String = ""

    func increment() { count += 1 }
}

struct CounterView: View {
    @State var viewModel = CounterViewModel()

    var body: some View {
        Text("\(viewModel.count)")  // Only redraws when `count` changes
    }
}
```

**Key differences:**
- No need for `@Published` -- all stored properties are automatically tracked
- Use `@State` instead of `@StateObject` for ownership
- Use `@Bindable` instead of `@ObservedObject` for bindings
- **Granular tracking**: Only properties actually read in the view body trigger redraws (major performance win)
- No Combine dependency

**Recommendation:** Use `@Observable` for all new code. Only use `ObservableObject` if targeting iOS 16 or below.

### Architecture: MVVM Is Still Standard (But Simpler)

With `@Observable`, MVVM is lighter and more natural:

```swift
// Model
struct GroceryItem: Identifiable, Codable {
    let id: UUID
    var name: String
    var isChecked: Bool
    var section: String
}

// ViewModel (using @Observable)
@Observable
final class GroceryListViewModel {
    var items: [GroceryItem] = []
    var isLoading = false
    var error: Error?

    private let supabase: SupabaseClient

    init(supabase: SupabaseClient) {
        self.supabase = supabase
    }

    func loadItems(for sessionId: UUID) async {
        isLoading = true
        defer { isLoading = false }
        do {
            items = try await supabase
                .from("grocery_items")
                .select()
                .eq("session_id", value: sessionId)
                .execute()
                .value
        } catch {
            self.error = error
        }
    }
}

// View
struct GroceryListView: View {
    @State var viewModel: GroceryListViewModel

    var body: some View {
        List {
            ForEach(viewModel.items) { item in
                GroceryItemRow(item: item)
            }
        }
        .overlay {
            if viewModel.isLoading {
                ProgressView()
            }
        }
    }
}
```

For a small app (5-7 screens), a flat structure works well -- no need for coordinators or complex DI frameworks.

### NavigationStack and NavigationPath

`NavigationStack` (iOS 16+) replaces `NavigationView` with programmatic, data-driven navigation.

**Basic NavigationStack with path:**
```swift
struct ContentView: View {
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            HomeView(path: $path)
                .navigationDestination(for: ListSession.self) { session in
                    GroceryListView(session: session)
                }
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .upload:
                        ImageUploadView()
                    case .clarify(let sections):
                        ClarifyView(sections: sections)
                    case .settings:
                        SettingsView()
                    }
                }
        }
    }
}

// Type-safe routes
enum Route: Hashable {
    case upload
    case clarify(sections: [ListSection])
    case settings
}

// Programmatic navigation
func navigateToClarify(sections: [ListSection]) {
    path.append(Route.clarify(sections: sections))
}

// Pop to root
func popToRoot() {
    path.removeLast(path.count)
}
```

`NavigationPath` is type-erased, allowing mixed types on the stack. For our app with a linear flow (upload -> clarify -> list), a simple enum-based `Route` is ideal.

### Environment and Dependency Injection

SwiftUI's `@Environment` is the standard DI mechanism:

```swift
// Define environment key
struct SupabaseClientKey: EnvironmentKey {
    static let defaultValue: SupabaseClient = supabase  // global default
}

extension EnvironmentValues {
    var supabaseClient: SupabaseClient {
        get { self[SupabaseClientKey.self] }
        set { self[SupabaseClientKey.self] = newValue }
    }
}

// Inject at app level
@main
struct GroceryApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.supabaseClient, supabase)
        }
    }
}

// Consume in any view
struct SomeView: View {
    @Environment(\.supabaseClient) var supabase
}
```

For `@Observable` objects, you can also inject them directly into the environment:

```swift
@Observable
final class AuthManager {
    var session: Session?
    var isAuthenticated: Bool { session != nil }
}

// Inject
ContentView()
    .environment(authManager)

// Consume
struct ProfileView: View {
    @Environment(AuthManager.self) var auth
}
```

### Recommended App Structure (5-7 screens)

```
GroceryList/
  GroceryListApp.swift          // @main, app entry point
  ContentView.swift             // Root view with auth routing

  Models/
    GroceryItem.swift           // Data models (Codable structs)
    ListSession.swift
    ListSection.swift

  ViewModels/
    AuthViewModel.swift         // Sign in with Apple, session management
    ImageAnalysisViewModel.swift // Photo capture, AI analysis
    GroceryListViewModel.swift  // List management, check/uncheck
    HistoryViewModel.swift      // Past sessions

  Views/
    Auth/
      SignInView.swift
    Upload/
      ImageUploadView.swift
      CameraView.swift
    Clarify/
      ClarifyView.swift
      SectionCard.swift
    List/
      GroceryListView.swift
      SectionHeader.swift
      GroceryItemRow.swift
    History/
      HistoryView.swift
      SessionCard.swift
    Settings/
      SettingsView.swift

  Services/
    SupabaseService.swift       // Supabase client init + helpers
    ImageService.swift          // Compression, base64 conversion

  Utilities/
    StoreSections.swift         // Section mapping (migrated from React)
    Extensions.swift

  Resources/
    Assets.xcassets
```

---

## 2. supabase-swift SDK

### Current Version and Maturity

- **Version**: 2.41.1 (as of Feb 2026)
- **Maturity**: Production-ready, actively maintained
- **Requirements**: iOS 13+, Xcode 15.3+, Swift 5.10+
- **Install**: Swift Package Manager via `https://github.com/supabase/supabase-swift`

### Initialization

```swift
import Supabase

// Global client (simple approach for small apps)
let supabase = SupabaseClient(
    supabaseURL: URL(string: "https://your-project.supabase.co")!,
    supabaseKey: "your-anon-key"
)
```

Advanced configuration:
```swift
let supabase = SupabaseClient(
    supabaseURL: URL(string: "https://your-project.supabase.co")!,
    supabaseKey: "your-anon-key",
    options: SupabaseClientOptions(
        db: .init(schema: "public"),
        auth: .init(
            storage: KeychainLocalStorage(),  // Custom secure storage
            flowType: .pkce
        ),
        global: .init(
            headers: ["x-app-version": "1.0.0"]
        )
    )
)
```

### Sign in with Apple - Complete Flow

The flow has three parts: (a) generate a nonce, (b) present Apple's sign-in UI, (c) exchange the token with Supabase.

```swift
import AuthenticationServices
import CryptoKit
import Supabase

@Observable
final class AuthViewModel {
    var session: Session?
    var isAuthenticated: Bool { session != nil }
    var isLoading = false
    var error: Error?

    // Store the nonce for verification
    private var currentNonce: String?

    // MARK: - Nonce Generation

    private func randomNonceString(length: Int = 32) -> String {
        precondition(length > 0)
        var randomBytes = [UInt8](repeating: 0, count: length)
        let errorCode = SecRandomCopyBytes(kSecRandomDefault, randomBytes.count, &randomBytes)
        precondition(errorCode == errSecSuccess, "Unable to generate nonce")

        let charset: [Character] = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        return String(randomBytes.map { charset[Int($0) % charset.count] })
    }

    private func sha256(_ input: String) -> String {
        let data = Data(input.utf8)
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }

    // MARK: - Sign In with Apple

    func signInWithApple() async {
        let nonce = randomNonceString()
        currentNonce = nonce
        let hashedNonce = sha256(nonce)

        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = hashedNonce

        // Use ASAuthorizationController with async/await wrapper
        do {
            let authorization = try await performAppleSignIn(request: request)
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let identityTokenData = credential.identityToken,
                  let identityToken = String(data: identityTokenData, encoding: .utf8) else {
                throw AuthError.missingToken
            }

            // Exchange with Supabase
            let session = try await supabase.auth.signInWithIdToken(
                credentials: OpenIDConnectCredentials(
                    provider: .apple,
                    idToken: identityToken,
                    nonce: nonce  // Raw nonce, not hashed
                )
            )

            self.session = session

            // Save full name (Apple only provides it on first sign-in)
            if let fullName = credential.fullName,
               let givenName = fullName.givenName {
                let familyName = fullName.familyName ?? ""
                try await supabase.auth.update(user: UserAttributes(
                    data: ["full_name": .string("\(givenName) \(familyName)")]
                ))
            }
        } catch {
            self.error = error
        }
    }

    // MARK: - Session Management

    func restoreSession() async {
        do {
            session = try await supabase.auth.session
        } catch {
            session = nil
        }
    }

    func signOut() async throws {
        try await supabase.auth.signOut()
        session = nil
    }
}

enum AuthError: LocalizedError {
    case missingToken

    var errorDescription: String? {
        switch self {
        case .missingToken: return "Failed to get identity token from Apple"
        }
    }
}
```

**SwiftUI Sign In button (built-in):**
```swift
import AuthenticationServices

struct SignInView: View {
    @Environment(AuthViewModel.self) var auth

    var body: some View {
        VStack(spacing: 20) {
            Text("Grocery List")
                .font(.largeTitle)

            SignInWithAppleButton(.signIn) { request in
                request.requestedScopes = [.fullName, .email]
            } onCompletion: { result in
                // Handle through the ASAuthorizationController approach instead
                // or use this simpler approach if you don't need the nonce
            }
            .signInWithAppleButtonStyle(.black)
            .frame(height: 50)
            .padding(.horizontal, 40)
        }
    }
}
```

**Note:** For Supabase integration, you typically need the nonce flow, which requires using `ASAuthorizationController` directly rather than the SwiftUI `SignInWithAppleButton`. The button can still be used for UI, but the action should trigger the nonce-based flow.

### Calling Edge Functions

```swift
// Simple call
let response = try await supabase.functions.invoke("analyze-grocery-list")

// With body data (image + prompt)
struct AnalyzeRequest: Encodable {
    let imageBase64: String
    let prompt: String
}

let request = AnalyzeRequest(
    imageBase64: imageData.base64EncodedString(),
    prompt: "Identify sections in this grocery list"
)

// Decode response directly into a Swift type
struct AnalyzeResponse: Decodable {
    let sections: [ListSection]
}

let result: AnalyzeResponse = try await supabase.functions.invoke(
    "analyze-grocery-list",
    options: FunctionInvokeOptions(body: request)
)

// Error handling
do {
    let result: AnalyzeResponse = try await supabase.functions.invoke(
        "analyze-grocery-list",
        options: FunctionInvokeOptions(body: request)
    )
} catch FunctionsError.httpError(let code, let data) {
    let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
    print("Edge function failed (\(code)): \(errorMessage)")
} catch {
    print("Network error: \(error)")
}

// Specifying HTTP method and query params
let result = try await supabase.functions.invoke(
    "my-function",
    options: FunctionInvokeOptions(
        method: .get,
        headers: ["x-custom": "value"],
        query: [URLQueryItem(name: "id", value: "123")]
    )
)
```

### Database Queries

**Define Codable models:**
```swift
struct GroceryItem: Codable, Identifiable {
    let id: UUID
    let sessionId: UUID
    var name: String
    var section: String
    var isChecked: Bool
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case sessionId = "session_id"
        case name, section
        case isChecked = "is_checked"
        case createdAt = "created_at"
    }
}
```

**Select (read):**
```swift
// Fetch all items for a session
let items: [GroceryItem] = try await supabase
    .from("grocery_items")
    .select()
    .eq("session_id", value: sessionId)
    .order("section")
    .execute()
    .value

// Fetch with related data (foreign table join)
struct SessionWithItems: Decodable {
    let id: UUID
    let name: String
    let groceryItems: [GroceryItem]

    enum CodingKeys: String, CodingKey {
        case id, name
        case groceryItems = "grocery_items"
    }
}

let session: SessionWithItems = try await supabase
    .from("list_sessions")
    .select("id, name, grocery_items(*)")
    .eq("id", value: sessionId)
    .single()
    .execute()
    .value
```

**Insert:**
```swift
// Single item
let newItem = GroceryItem(
    id: UUID(),
    sessionId: sessionId,
    name: "Milk",
    section: "Dairy",
    isChecked: false,
    createdAt: Date()
)

try await supabase
    .from("grocery_items")
    .insert(newItem)
    .execute()

// Insert and return the created row
let created: GroceryItem = try await supabase
    .from("grocery_items")
    .insert(newItem)
    .select()
    .single()
    .execute()
    .value

// Bulk insert
try await supabase
    .from("grocery_items")
    .insert(items)
    .execute()
```

**Update:**
```swift
// Update a single field
try await supabase
    .from("grocery_items")
    .update(["is_checked": true])
    .eq("id", value: itemId)
    .execute()

// Update with a Codable struct
struct ItemUpdate: Encodable {
    let isChecked: Bool

    enum CodingKeys: String, CodingKey {
        case isChecked = "is_checked"
    }
}

try await supabase
    .from("grocery_items")
    .update(ItemUpdate(isChecked: true))
    .eq("id", value: itemId)
    .execute()
```

**Delete:**
```swift
try await supabase
    .from("grocery_items")
    .delete()
    .eq("id", value: itemId)
    .execute()
```

**Important:** Default max return is 1000 rows. Use `.range(from:to:)` for pagination.

---

## 3. SwiftData

### Model Definition with @Model

```swift
import SwiftData

@Model
final class ListSession {
    var name: String
    var createdAt: Date
    var thumbnailData: Data?

    // Relationship: one session has many items
    @Relationship(deleteRule: .cascade, inverse: \GroceryItem.session)
    var items: [GroceryItem] = []

    init(name: String, createdAt: Date = Date(), thumbnailData: Data? = nil) {
        self.name = name
        self.createdAt = createdAt
        self.thumbnailData = thumbnailData
    }
}

@Model
final class GroceryItem {
    var name: String
    var section: String
    var isChecked: Bool
    var session: ListSession?

    init(name: String, section: String, isChecked: Bool = false) {
        self.name = name
        self.section = section
        self.isChecked = isChecked
    }
}
```

### ModelContainer Setup

```swift
@main
struct GroceryListApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: [ListSession.self, GroceryItem.self])
    }
}
```

### Querying with @Query

```swift
struct HistoryView: View {
    // Automatically fetches and stays in sync
    @Query(sort: \ListSession.createdAt, order: .reverse)
    var sessions: [ListSession]

    var body: some View {
        List(sessions) { session in
            SessionRow(session: session)
        }
    }
}

// With predicates (filtering)
struct ActiveItemsView: View {
    @Query(
        filter: #Predicate<GroceryItem> { !$0.isChecked },
        sort: \GroceryItem.section
    )
    var uncheckedItems: [GroceryItem]
}
```

### CRUD Operations with ModelContext

```swift
struct GroceryListView: View {
    @Environment(\.modelContext) var modelContext
    @Query var items: [GroceryItem]

    func addItem(name: String, section: String) {
        let item = GroceryItem(name: name, section: section)
        modelContext.insert(item)
        // SwiftData auto-saves
    }

    func deleteItem(_ item: GroceryItem) {
        modelContext.delete(item)
    }

    func toggleItem(_ item: GroceryItem) {
        item.isChecked.toggle()
        // Changes are automatically tracked and saved
    }
}
```

### SwiftData vs Core Data

- **Much simpler**: No .xcdatamodeld file, no NSManagedObject subclasses
- **Pure Swift**: Uses macros instead of Objective-C runtime
- **Automatic save**: Changes persist without explicit save calls
- **@Query is reactive**: Like React's useState -- the view updates when data changes
- **Relationships are just properties**: No need for NSSet or type casting

### Simple Key-Value Storage (Replacing localStorage)

For simple preferences (API key, settings, theme), use `@AppStorage`:

```swift
struct SettingsView: View {
    @AppStorage("prefersDarkMode") var prefersDarkMode = false
    @AppStorage("defaultStore") var defaultStore = "Kroger"

    var body: some View {
        Form {
            Toggle("Dark Mode", isOn: $prefersDarkMode)
            TextField("Default Store", text: $defaultStore)
        }
    }
}
```

For sensitive data like auth tokens, use Keychain (Supabase SDK handles this for auth sessions).

**Important:** `@AppStorage` writes to `UserDefaults` -- not secure for API keys or tokens. Use Keychain for sensitive values:

```swift
import Security

enum KeychainHelper {
    static func save(key: String, data: Data) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]
        SecItemDelete(query as CFDictionary)
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }

    static func load(key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnData as String: true
        ]
        var result: AnyObject?
        SecItemCopyMatching(query as CFDictionary, &result)
        return result as? Data
    }
}
```

### When to Use SwiftData vs Supabase

For this app:
- **SwiftData**: Offline cache of grocery lists, local draft state, recently viewed sessions
- **Supabase DB**: Source of truth for all user data, synced across devices
- **@AppStorage**: UI preferences (dark mode, default view)
- **Keychain**: Auth tokens (handled by Supabase SDK)

---

## 4. Camera and Image Handling

### PhotosPicker (Picking from Library)

```swift
import PhotosUI
import SwiftUI

struct ImageUploadView: View {
    @State private var selectedItem: PhotosPickerItem?
    @State private var selectedImageData: Data?
    @State private var displayImage: Image?

    var body: some View {
        VStack(spacing: 20) {
            if let displayImage {
                displayImage
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 300)
            } else {
                ContentUnavailableView(
                    "No Photo Selected",
                    systemImage: "photo.badge.plus",
                    description: Text("Take a photo or choose from your library")
                )
            }

            PhotosPicker(
                selection: $selectedItem,
                matching: .images,
                photoLibrary: .shared()
            ) {
                Label("Choose from Library", systemImage: "photo.on.rectangle")
            }
        }
        .onChange(of: selectedItem) { _, newItem in
            Task {
                guard let data = try? await newItem?.loadTransferable(type: Data.self) else { return }
                selectedImageData = data
                if let uiImage = UIImage(data: data) {
                    displayImage = Image(uiImage: uiImage)
                }
            }
        }
    }
}
```

### Camera Capture

SwiftUI does not have a native camera view. Wrap `UIImagePickerController`:

```swift
import SwiftUI

struct CameraPicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker

        init(_ parent: CameraPicker) {
            self.parent = parent
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage {
                parent.image = image
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

// Usage in a view
struct ImageUploadView: View {
    @State private var showCamera = false
    @State private var capturedImage: UIImage?

    var body: some View {
        Button("Take Photo") {
            showCamera = true
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker(image: $capturedImage)
                .ignoresSafeArea()
        }
    }
}
```

### Image to Base64 for API Calls

```swift
extension UIImage {
    /// Compress and convert to base64 for sending to the AI API
    func toBase64(maxWidth: CGFloat = 1024, compressionQuality: CGFloat = 0.8) -> String? {
        let resized = self.resized(toMaxWidth: maxWidth)
        guard let data = resized.jpegData(compressionQuality: compressionQuality) else { return nil }
        return data.base64EncodedString()
    }

    /// Create a smaller thumbnail for storage
    func toThumbnailData(maxWidth: CGFloat = 400, quality: CGFloat = 0.6) -> Data? {
        let resized = self.resized(toMaxWidth: maxWidth)
        return resized.jpegData(compressionQuality: quality)
    }

    private func resized(toMaxWidth maxWidth: CGFloat) -> UIImage {
        guard size.width > maxWidth else { return self }
        let scale = maxWidth / size.width
        let newSize = CGSize(width: maxWidth, height: size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        return renderer.image { _ in
            draw(in: CGRect(origin: .zero, size: newSize))
        }
    }
}

// Usage: sending image to edge function
func analyzeImage(_ image: UIImage) async throws -> AnalyzeResponse {
    guard let base64 = image.toBase64() else {
        throw ImageError.compressionFailed
    }

    let result: AnalyzeResponse = try await supabase.functions.invoke(
        "analyze-grocery-list",
        options: FunctionInvokeOptions(
            body: ["image_base64": base64]
        )
    )
    return result
}
```

### Combined Upload View (Camera + Library)

```swift
struct ImageSourceView: View {
    @State private var selectedItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var image: UIImage?

    var onImageSelected: (UIImage) -> Void

    var body: some View {
        VStack(spacing: 16) {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 300)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            HStack(spacing: 16) {
                Button {
                    showCamera = true
                } label: {
                    Label("Camera", systemImage: "camera")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)

                PhotosPicker(selection: $selectedItem, matching: .images) {
                    Label("Library", systemImage: "photo")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker(image: $image)
                .ignoresSafeArea()
        }
        .onChange(of: selectedItem) { _, newItem in
            Task {
                guard let data = try? await newItem?.loadTransferable(type: Data.self),
                      let uiImage = UIImage(data: data) else { return }
                image = uiImage
            }
        }
        .onChange(of: image) { _, newImage in
            if let newImage {
                onImageSelected(newImage)
            }
        }
    }
}
```

---

## 5. Networking Layer

### Structuring API Calls

All network calls go through Supabase SDK (no raw URLSession needed). Organize into service classes:

```swift
@Observable
final class ImageAnalysisService {
    var isAnalyzing = false
    var analysisError: Error?

    func analyzeGroceryList(image: UIImage) async throws -> [ListSection] {
        isAnalyzing = true
        defer { isAnalyzing = false }

        guard let base64 = image.toBase64() else {
            throw AppError.imageCompressionFailed
        }

        struct Request: Encodable {
            let imageBase64: String

            enum CodingKeys: String, CodingKey {
                case imageBase64 = "image_base64"
            }
        }

        struct Response: Decodable {
            let sections: [ListSection]
        }

        let response: Response = try await supabase.functions.invoke(
            "analyze-grocery-list",
            options: FunctionInvokeOptions(body: Request(imageBase64: base64))
        )

        return response.sections
    }

    func categorizeItems(_ items: [String]) async throws -> [GroceryItem] {
        struct Request: Encodable {
            let items: [String]
        }

        struct Response: Decodable {
            let categorizedItems: [GroceryItem]

            enum CodingKeys: String, CodingKey {
                case categorizedItems = "categorized_items"
            }
        }

        let response: Response = try await supabase.functions.invoke(
            "categorize-items",
            options: FunctionInvokeOptions(body: Request(items: items))
        )

        return response.categorizedItems
    }
}
```

### Loading States and Error Handling Pattern

```swift
// Generic loading state enum
enum LoadingState<T> {
    case idle
    case loading
    case loaded(T)
    case error(Error)

    var value: T? {
        if case .loaded(let value) = self { return value }
        return nil
    }

    var isLoading: Bool {
        if case .loading = self { return true }
        return false
    }
}

// Usage in a ViewModel
@Observable
final class GroceryListViewModel {
    var state: LoadingState<[GroceryItem]> = .idle

    func loadItems(sessionId: UUID) async {
        state = .loading
        do {
            let items: [GroceryItem] = try await supabase
                .from("grocery_items")
                .select()
                .eq("session_id", value: sessionId)
                .execute()
                .value
            state = .loaded(items)
        } catch {
            state = .error(error)
        }
    }
}

// Usage in a View
struct GroceryListView: View {
    @State var viewModel = GroceryListViewModel()
    let sessionId: UUID

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle:
                Color.clear
            case .loading:
                ProgressView("Loading items...")
            case .loaded(let items):
                GroceryItemsList(items: items)
            case .error(let error):
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error.localizedDescription)
                } actions: {
                    Button("Retry") {
                        Task { await viewModel.loadItems(sessionId: sessionId) }
                    }
                }
            }
        }
        .task {
            await viewModel.loadItems(sessionId: sessionId)
        }
    }
}
```

### Image Upload + AI Response Flow

The complete flow for our app:

```swift
@Observable
final class ListCreationViewModel {
    var image: UIImage?
    var sections: [ListSection] = []
    var categorizedItems: [GroceryItem] = []

    var analysisState: LoadingState<[ListSection]> = .idle
    var categorizationState: LoadingState<[GroceryItem]> = .idle

    // Step 1: Analyze the image
    func analyzeImage() async {
        guard let image else { return }
        analysisState = .loading

        do {
            guard let base64 = image.toBase64() else {
                throw AppError.imageCompressionFailed
            }

            struct Response: Decodable {
                let sections: [ListSection]
            }

            let response: Response = try await supabase.functions.invoke(
                "analyze-grocery-list",
                options: FunctionInvokeOptions(body: ["image_base64": base64])
            )

            sections = response.sections
            analysisState = .loaded(response.sections)
        } catch {
            analysisState = .error(error)
        }
    }

    // Step 2: Categorize selected items
    func categorizeSelectedItems(_ selectedItems: [String]) async {
        categorizationState = .loading

        do {
            struct Response: Decodable {
                let items: [GroceryItem]
            }

            let response: Response = try await supabase.functions.invoke(
                "categorize-items",
                options: FunctionInvokeOptions(body: ["items": selectedItems])
            )

            categorizedItems = response.items
            categorizationState = .loaded(response.items)
        } catch {
            categorizationState = .error(error)
        }
    }

    // Step 3: Save session to Supabase
    func saveSession(name: String) async throws -> UUID {
        let sessionId = UUID()

        struct NewSession: Encodable {
            let id: UUID
            let name: String
            let createdAt: Date

            enum CodingKeys: String, CodingKey {
                case id, name
                case createdAt = "created_at"
            }
        }

        // Save session
        try await supabase
            .from("list_sessions")
            .insert(NewSession(id: sessionId, name: name, createdAt: Date()))
            .execute()

        // Save items
        let itemsToSave = categorizedItems.map { item in
            GroceryItemInsert(
                sessionId: sessionId,
                name: item.name,
                section: item.section,
                isChecked: false
            )
        }

        try await supabase
            .from("grocery_items")
            .insert(itemsToSave)
            .execute()

        // Upload thumbnail
        if let thumbnailData = image?.toThumbnailData() {
            try await supabase.storage
                .from("list-thumbnails")
                .upload(
                    path: "\(sessionId).jpg",
                    file: thumbnailData,
                    options: FileOptions(contentType: "image/jpeg")
                )
        }

        return sessionId
    }
}
```

### Retry Logic

```swift
func withRetry<T>(
    maxAttempts: Int = 3,
    delay: Duration = .seconds(1),
    operation: () async throws -> T
) async throws -> T {
    var lastError: Error?
    for attempt in 1...maxAttempts {
        do {
            return try await operation()
        } catch {
            lastError = error
            if attempt < maxAttempts {
                try await Task.sleep(for: delay * attempt)
            }
        }
    }
    throw lastError!
}

// Usage
let result = try await withRetry {
    try await supabase.functions.invoke("analyze-grocery-list", options: options)
}
```

---

## 6. Project Structure Summary

### Xcode Project Setup

1. Create new Xcode project: iOS -> App
2. Interface: SwiftUI, Language: Swift
3. Storage: SwiftData (optional -- only if we want local caching)
4. Add SPM dependency: `https://github.com/supabase/supabase-swift` (from: "2.0.0")
5. Enable "Sign in with Apple" capability in Signing & Capabilities
6. Add Camera Usage Description to Info.plist: `NSCameraUsageDescription`
7. Add Photo Library Usage Description: `NSPhotoLibraryUsageDescription`

### Recommended Folder Layout

```
GroceryList/
  GroceryListApp.swift              // @main entry point
  ContentView.swift                 // Root: auth routing + NavigationStack

  Models/
    GroceryItem.swift               // Codable model
    ListSession.swift               // Codable model
    ListSection.swift               // Section from AI analysis
    Route.swift                     // Navigation routes enum

  ViewModels/
    AuthViewModel.swift             // Sign in with Apple + Supabase auth
    ListCreationViewModel.swift     // Image -> analyze -> categorize -> save
    GroceryListViewModel.swift      // View/edit a single list
    HistoryViewModel.swift          // Browse past lists

  Views/
    SignInView.swift
    ImageUploadView.swift
    ClarifyView.swift
    GroceryListView.swift
    HistoryView.swift
    SettingsView.swift
    Components/                     // Reusable view components
      GroceryItemRow.swift
      SectionHeader.swift
      SessionCard.swift
      CameraPicker.swift
      LoadingOverlay.swift

  Services/
    SupabaseClient.swift            // Global Supabase client init
    ImageService.swift              // Compression, base64
    StoreSections.swift             // Kroger section mapping

  Extensions/
    UIImage+Resize.swift
    View+Loading.swift

  Resources/
    Assets.xcassets
    Info.plist
```

### App Entry Point

```swift
import SwiftUI

@main
struct GroceryListApp: App {
    @State private var authViewModel = AuthViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(authViewModel)
                .task {
                    await authViewModel.restoreSession()
                }
        }
    }
}
```

### Root View with Auth Routing

```swift
struct ContentView: View {
    @Environment(AuthViewModel.self) var auth

    var body: some View {
        Group {
            if auth.isAuthenticated {
                MainTabView()
            } else {
                SignInView()
            }
        }
        .animation(.default, value: auth.isAuthenticated)
    }
}
```

---

## 7. Service Abstraction Layer

The app should not depend directly on Supabase throughout the codebase. All external service interactions should go through Swift protocols, with Supabase as the concrete implementation. This makes it possible to swap providers (e.g., move to CloudKit, Firebase, a custom backend) without touching view models or views.

### Protocol Definitions

```swift
// MARK: - Auth

protocol AuthService {
    var currentUser: User? { get }
    var isAuthenticated: Bool { get }

    func signInWithApple() async throws
    func signOut() async throws
    func restoreSession() async throws
}

struct User: Identifiable {
    let id: UUID
    let email: String?
    let displayName: String?
}

// MARK: - Grocery Analysis (API Proxy)

protocol GroceryAnalysisService {
    func analyzeImage(_ imageData: Data) async throws -> [GrocerySection]
    func categorizeItems(_ items: [UncategorizedItem]) async throws -> [CategorizedItem]
}

struct GrocerySection: Codable, Identifiable {
    let id: UUID
    let name: String
    let type: SectionType
    let items: [String]

    enum SectionType: String, Codable {
        case grocery, mealPlan = "meal_plan", crossedOut = "crossed_out", notes
    }
}

struct UncategorizedItem: Codable {
    let id: String
    let name: String
    let category: String
}

struct CategorizedItem: Codable {
    let id: String
    let name: String
    let category: String
}

// MARK: - Subscription

protocol SubscriptionService {
    var isSubscribed: Bool { get }
    var remainingFreeScans: Int { get }

    func checkEntitlement() async throws
    func recordScanUsage() async throws
}

// MARK: - List Storage

protocol ListStorageService {
    func saveScan(items: [CategorizedItem], thumbnail: Data?) async throws -> UUID
    func loadScan(id: UUID) async throws -> SavedScan
    func listScans() async throws -> [ScanSummary]
    func deleteScan(id: UUID) async throws
}

struct SavedScan: Identifiable {
    let id: UUID
    let items: [CategorizedItem]
    let thumbnailData: Data?
    let createdAt: Date
}

struct ScanSummary: Identifiable {
    let id: UUID
    let itemCount: Int
    let createdAt: Date
    let thumbnailData: Data?
}
```

### Supabase Implementations

Each protocol gets a concrete Supabase implementation:

```swift
// MARK: - SupabaseAuthService

@Observable
final class SupabaseAuthService: AuthService {
    private let client: SupabaseClient
    private(set) var currentUser: User?

    var isAuthenticated: Bool { currentUser != nil }

    init(client: SupabaseClient) {
        self.client = client
    }

    func signInWithApple() async throws {
        // Nonce-based Apple sign-in flow + Supabase token exchange
        // (full implementation in Section 2 above)
    }

    func signOut() async throws {
        try await client.auth.signOut()
        currentUser = nil
    }

    func restoreSession() async throws {
        let session = try await client.auth.session
        currentUser = User(
            id: session.user.id,
            email: session.user.email,
            displayName: session.user.userMetadata["full_name"]?.stringValue
        )
    }
}

// MARK: - SupabaseGroceryAnalysisService

final class SupabaseGroceryAnalysisService: GroceryAnalysisService {
    private let client: SupabaseClient

    init(client: SupabaseClient) {
        self.client = client
    }

    func analyzeImage(_ imageData: Data) async throws -> [GrocerySection] {
        struct Request: Encodable {
            let imageBase64: String
            let mediaType: String
        }

        struct Response: Decodable {
            let sections: [GrocerySection]
        }

        let response: Response = try await client.functions.invoke(
            "analyze-grocery-list",
            options: FunctionInvokeOptions(
                body: Request(
                    imageBase64: imageData.base64EncodedString(),
                    mediaType: "image/jpeg"
                )
            )
        )
        return response.sections
    }

    func categorizeItems(_ items: [UncategorizedItem]) async throws -> [CategorizedItem] {
        struct Response: Decodable { let items: [CategorizedItem] }

        let response: Response = try await client.functions.invoke(
            "categorize-items",
            options: FunctionInvokeOptions(body: ["items": items])
        )
        return response.items
    }
}

// MARK: - SupabaseListStorageService

final class SupabaseListStorageService: ListStorageService {
    private let client: SupabaseClient

    init(client: SupabaseClient) {
        self.client = client
    }

    func saveScan(items: [CategorizedItem], thumbnail: Data?) async throws -> UUID {
        // Insert into list_sessions and grocery_items tables
        // Upload thumbnail to Supabase Storage
        // ...
    }

    func loadScan(id: UUID) async throws -> SavedScan { /* ... */ }
    func listScans() async throws -> [ScanSummary] { /* ... */ }
    func deleteScan(id: UUID) async throws { /* ... */ }
}
```

### Dependency Injection via Environment

Wire up the protocols at the app root. Views and view models only depend on protocols, never on Supabase directly:

```swift
// Environment keys for each service protocol
struct AuthServiceKey: EnvironmentKey {
    static let defaultValue: any AuthService = SupabaseAuthService(client: supabase)
}

struct GroceryAnalysisServiceKey: EnvironmentKey {
    static let defaultValue: any GroceryAnalysisService = SupabaseGroceryAnalysisService(client: supabase)
}

struct ListStorageServiceKey: EnvironmentKey {
    static let defaultValue: any ListStorageService = SupabaseListStorageService(client: supabase)
}

extension EnvironmentValues {
    var authService: any AuthService {
        get { self[AuthServiceKey.self] }
        set { self[AuthServiceKey.self] = newValue }
    }
    var groceryAnalysisService: any GroceryAnalysisService {
        get { self[GroceryAnalysisServiceKey.self] }
        set { self[GroceryAnalysisServiceKey.self] = newValue }
    }
    var listStorageService: any ListStorageService {
        get { self[ListStorageServiceKey.self] }
        set { self[ListStorageServiceKey.self] = newValue }
    }
}

// App entry point
@main
struct GroceryListApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
            // Default implementations are Supabase-backed.
            // To swap providers, override here:
            // .environment(\.authService, FirebaseAuthService())
            // .environment(\.listStorageService, CloudKitListStorageService())
        }
    }
}
```

### View Models Depend on Protocols

```swift
@Observable
final class ListCreationViewModel {
    private let analysisService: any GroceryAnalysisService
    private let storageService: any ListStorageService

    init(
        analysisService: any GroceryAnalysisService,
        storageService: any ListStorageService
    ) {
        self.analysisService = analysisService
        self.storageService = storageService
    }

    func analyzeImage(_ imageData: Data) async throws -> [GrocerySection] {
        try await analysisService.analyzeImage(imageData)
    }

    func saveList(items: [CategorizedItem], thumbnail: Data?) async throws -> UUID {
        try await storageService.saveScan(items: items, thumbnail: thumbnail)
    }
}
```

### What This Buys You

- **Swap Supabase out**: Write a `CloudKitListStorageService` or `FirebaseAuthService` conforming to the same protocol. Change one line at the app root.
- **Testing**: Inject mock implementations in previews and unit tests.
- **Incremental migration**: If you outgrow Supabase, migrate one service at a time (e.g., move storage to CloudKit while keeping auth on Supabase).
- **No viral dependency**: Supabase imports are confined to the `Services/` folder. Views and view models never import Supabase.

### Updated Project Structure

```
GroceryList/
  Services/
    Protocols/
      AuthService.swift
      GroceryAnalysisService.swift
      SubscriptionService.swift
      ListStorageService.swift
    Supabase/
      SupabaseClient.swift               // Global client init
      SupabaseAuthService.swift
      SupabaseGroceryAnalysisService.swift
      SupabaseListStorageService.swift
    Environment/
      ServiceEnvironmentKeys.swift       // EnvironmentKey definitions
```

All Supabase-specific code lives in `Services/Supabase/`. Everything else depends only on the protocols in `Services/Protocols/`.

---

## Key Takeaways

1. **@Observable is the standard** -- use it for all view models and service objects. No more @Published boilerplate.
2. **Supabase Swift SDK is mature** (v2.41.1) -- handles auth, DB, edge functions, and storage with clean async/await APIs.
3. **Sign in with Apple + Supabase** requires a nonce-based flow: generate nonce -> Apple auth -> exchange ID token with Supabase.
4. **SwiftData is optional** for this app -- since Supabase is the source of truth, SwiftData would only be useful for offline caching. Can be added later if needed.
5. **PhotosPicker + UIImagePickerController** cover the image input needs. PhotosPicker for library, UIImagePickerController wrapper for camera.
6. **Edge functions** are the path for AI integration -- send base64 image data, receive structured JSON responses.
7. **NavigationStack with enum-based routes** gives us the same linear flow as the React app (upload -> clarify -> list) with full programmatic control.
8. **@AppStorage** for preferences, **Keychain** for secrets, **Supabase DB** for user data.
