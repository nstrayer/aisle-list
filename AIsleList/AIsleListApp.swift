import SwiftUI
import SwiftData

@main
struct AIsleListApp: App {
    let container: ModelContainer
    @State private var authService: SupabaseAuthService?
    @State private var analysisService: (any GroceryAnalysisService)?

    init() {
        do {
            let schema = Schema([ListSession.self, GroceryItem.self])
            let config = ModelConfiguration(isStoredInMemoryOnly: false)
            container = try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.authService, authService)
                .environment(\.analysisService, analysisService)
                .task {
                    setupServices()
                }
        }
        .modelContainer(container)
    }

    private func setupServices() {
        // Check if Supabase is configured with valid URL + anon key
        guard let urlString = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
              let anonKey = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String,
              let auth = SupabaseAuthService(urlString: urlString, anonKey: anonKey) else {
            // Supabase not configured or invalid -> BYOK mode
            return
        }
        authService = auth
        analysisService = SupabaseAnalysisService(authService: auth)
        Task {
            await auth.restoreSession()
        }
    }
}
