import SwiftUI
import SwiftData

struct GroceryListView: View {
    @Bindable var session: ListSession
    let onNewList: () -> Void
    let onOpenHistory: () -> Void

    @Environment(\.modelContext) private var modelContext

    @State private var sanityState: SanityState = .idle
    @State private var showHistory = false

    enum SanityState {
        case idle
        case checking
        case suggestions([CategorySuggestion])
        case error(String)
    }

    // MARK: - Grouped + sorted items

    private var sortedSections: [(name: String, items: [GroceryItem])] {
        // Group by category
        var groups: [String: [GroceryItem]] = [:]
        for item in session.items {
            groups[item.category, default: []].append(item)
        }

        // Sort within each group: unchecked first, then by sortOrder
        for key in groups.keys {
            groups[key]?.sort { a, b in
                if a.isChecked != b.isChecked { return !a.isChecked }
                return a.sortOrder < b.sortOrder
            }
        }

        // Section ordering: known sections (in store order), dynamic (alphabetical), then Other
        let known = StoreSections.sectionOrder.filter { $0 != "Other" && groups[$0] != nil }
        let dynamic = groups.keys
            .filter { !StoreSections.sectionOrder.contains($0) }
            .sorted()
        let other: [String] = groups["Other"] != nil ? ["Other"] : []

        let orderedKeys = known + dynamic + other
        return orderedKeys.compactMap { key in
            guard let items = groups[key] else { return nil }
            return (name: key, items: items)
        }
    }

    var body: some View {
        List {
            Section {
                GroceryListHeader(session: session, onRename: renameSession)
            }
            .listRowSeparator(.hidden)

            sanityBannerSection

            ForEach(sortedSections, id: \.name) { section in
                GrocerySectionView(
                    sectionName: section.name,
                    items: section.items,
                    onToggle: toggleItem,
                    onDelete: deleteItem,
                    onRename: renameItem,
                    onRecategorize: recategorizeItem
                )
            }

            Section {
                AddItemButton(action: addItem)
            }
            .listRowSeparator(.hidden)
        }
        .listStyle(.insetGrouped)
        .navigationTitle(session.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button(action: onNewList) {
                        Label("New List", systemImage: "doc.badge.plus")
                    }
                    Button {
                        showHistory = true
                    } label: {
                        Label("History", systemImage: "clock.arrow.circlepath")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showHistory) {
            HistoryView(onSelect: { _ in showHistory = false })
        }
    }

    // MARK: - Sanity Banner

    @ViewBuilder
    private var sanityBannerSection: some View {
        switch sanityState {
        case .idle:
            EmptyView()
        case .checking:
            Section {
                SanityCheckBanner(state: .checking)
            }
            .listRowSeparator(.hidden)
        case .error(let msg):
            Section {
                SanityCheckBanner(state: .error(msg, onDismiss: {
                    sanityState = .idle
                }, onRetry: nil))
            }
            .listRowSeparator(.hidden)
        case .suggestions(let suggestions):
            Section {
                SanityCheckBanner(state: .suggestions(suggestions, onAccept: {
                    acceptSuggestions(suggestions)
                }, onDismiss: {
                    sanityState = .idle
                }))
            }
            .listRowSeparator(.hidden)
        }
    }

    // MARK: - Actions

    private func toggleItem(_ item: GroceryItem) {
        item.isChecked.toggle()
        session.updatedAt = Date()
    }

    private func deleteItem(_ item: GroceryItem) {
        modelContext.delete(item)
        session.updatedAt = Date()
    }

    private func renameItem(_ item: GroceryItem, _ newName: String) {
        item.name = newName
        item.category = StoreSections.categorizeItem(newName)
        session.updatedAt = Date()
    }

    private func recategorizeItem(_ item: GroceryItem, _ newCategory: String) {
        item.category = newCategory
        session.updatedAt = Date()
    }

    private func addItem() {
        let item = GroceryItem(name: "New item", category: "Other", sortOrder: session.itemCount)
        session.items.append(item)
        session.updatedAt = Date()
    }

    private func renameSession(_ name: String) {
        session.name = name
        session.updatedAt = Date()
    }

    private func acceptSuggestions(_ suggestions: [CategorySuggestion]) {
        for suggestion in suggestions {
            if let item = session.items.first(where: { $0.id == suggestion.id }) {
                item.category = suggestion.to
            }
        }
        session.updatedAt = Date()
        sanityState = .idle
    }
}
