import SwiftUI

struct GroceryListView: View {
    @Binding var items: [GroceryItem]
    @Binding var sessionName: String
    let uploadedImage: Data?
    let isSanityChecking: Bool
    let pendingSuggestions: [CategorySuggestion]
    let sanityCheckError: String?
    let itemsChangedSinceCheck: Bool
    let onAcceptSuggestions: () -> Void
    let onRejectSuggestions: () -> Void
    let onDismissSanityError: () -> Void
    let onRecategorize: () -> Void
    let onRenameSession: (String) -> Void
    let onNewList: () -> Void

    /// IDs of items that were just checked and are "settling" (stay in unchecked position briefly).
    @State private var settlingItemIDs: Set<String> = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Header with progress ring
                GroceryListHeader(
                    checkedCount: items.filter(\.isChecked).count,
                    totalCount: items.count,
                    sessionName: $sessionName,
                    onRename: onRenameSession
                )

                // Sanity check banner
                SanityCheckBanner(
                    isSanityChecking: isSanityChecking,
                    pendingSuggestions: pendingSuggestions,
                    sanityCheckError: sanityCheckError,
                    itemsChangedSinceCheck: itemsChangedSinceCheck,
                    onAccept: onAcceptSuggestions,
                    onReject: onRejectSuggestions,
                    onDismissError: onDismissSanityError,
                    onRecategorize: onRecategorize
                )

                // Sections
                ForEach(sortedSections, id: \.self) { section in
                    if let sectionItems = groupedItems[section], !sectionItems.isEmpty {
                        GrocerySectionView(
                            sectionName: section,
                            items: sectionItems,
                            settlingItemIDs: settlingItemIDs,
                            onToggle: { item in toggleItem(item) },
                            onDelete: { item in deleteItem(item) },
                            onRename: { item, newName in renameItem(item, to: newName) },
                            onRecategorize: { item, newCategory in recategorizeItem(item, to: newCategory) }
                        )
                    }
                }

                // Add item button
                AddItemButton { addItem() }
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
    }

    // MARK: - Grouping & Sorting

    /// Items grouped by category.
    private var groupedItems: [String: [GroceryItem]] {
        Dictionary(grouping: items, by: \.category)
    }

    /// Section ordering: known sections first (in store order), then dynamic alphabetically, then "Other".
    private var sortedSections: [String] {
        let allCategories = Set(items.map(\.category))

        let known = StoreSections.sectionOrder.filter { section in
            section != "Other" && allCategories.contains(section)
        }

        let dynamic = allCategories
            .filter { !StoreSections.sectionOrder.contains($0) }
            .sorted()

        let other: [String] = allCategories.contains("Other") ? ["Other"] : []

        return known + dynamic + other
    }

    // MARK: - Actions

    private func toggleItem(_ item: GroceryItem) {
        guard let index = items.firstIndex(where: { $0.id == item.id }) else { return }

        if !item.isChecked {
            // Checking: add to settling set, remove after delay
            settlingItemIDs.insert(item.id)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                withAnimation(.easeInOut(duration: 0.3)) {
                    settlingItemIDs.remove(item.id)
                }
            }
        } else {
            // Unchecking: remove from settling immediately
            settlingItemIDs.remove(item.id)
        }

        withAnimation(.easeInOut(duration: 0.2)) {
            items[index].isChecked.toggle()
        }
    }

    private func deleteItem(_ item: GroceryItem) {
        withAnimation {
            items.removeAll { $0.id == item.id }
        }
    }

    private func renameItem(_ item: GroceryItem, to newName: String) {
        guard let index = items.firstIndex(where: { $0.id == item.id }) else { return }
        items[index].name = newName
        items[index].category = StoreSections.categorizeItem(newName)
    }

    private func recategorizeItem(_ item: GroceryItem, to newCategory: String) {
        guard let index = items.firstIndex(where: { $0.id == item.id }) else { return }
        items[index].category = newCategory
    }

    private func addItem() {
        let newItem = GroceryItem(name: "New item", category: "Other")
        withAnimation {
            items.append(newItem)
        }
    }
}
