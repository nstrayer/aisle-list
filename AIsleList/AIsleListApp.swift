import SwiftUI
import SwiftData

@main
struct AIsleListApp: App {
    let container: ModelContainer

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
        }
        .modelContainer(container)
    }
}
