import SwiftUI
import SwiftData

@main
struct AIsleListApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: [ListSession.self, GroceryItem.self])
    }
}
