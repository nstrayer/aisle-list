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
        // Check if Supabase is configured
        if let urlString = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
           !urlString.isEmpty,
           Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String != nil {
            let auth = SupabaseAuthService()
            authService = auth
            analysisService = SupabaseAnalysisService(authService: auth)
            Task {
                await auth.restoreSession()
            }
        }
        // If Supabase not configured, authService stays nil -> BYOK mode
    }
}
