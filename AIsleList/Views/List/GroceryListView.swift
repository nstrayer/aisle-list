import SwiftUI
import SwiftData

struct GroceryListView: View {
    @Bindable var session: ListSession
    let onNewList: () -> Void
    var onOpenHistory: (() -> Void)? = nil
    var onOpenSettings: (() -> Void)? = nil

    // Sanity check state passed from parent
    var isSanityChecking: Bool = false
    var pendingSuggestions: [CategorySuggestion] = []
    var sanityCheckError: String? = nil
    var itemsChangedSinceCheck: Bool = false
    var onAcceptSuggestions: (() -> Void)? = nil
    var onRejectSuggestions: (() -> Void)? = nil
    var onDismissSanityError: (() -> Void)? = nil
    var onRecategorize: (() -> Void)? = nil

    @Environment(\.modelContext) private var modelContext

    /// IDs of items that were just checked and are "settling" (stay in unchecked position briefly).
    @State private var settlingItems: Set<String> = []
    /// Cancellable tasks for settling timers so unchecking can cancel the delay.
    @State private var settleTasks: [String: Task<Void, Never>] = [:]

    var body: some View {
        let items = session.items
        let grouped = sortedSections(from: items)

        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                GroceryListHeader(
                    sessionName: session.name,
                    checkedCount: items.filter(\.isChecked).count,
                    totalCount: items.count,
                    thumbnailData: session.thumbnailData,
                    onRename: { newName in
                        session.name = newName
                        session.updatedAt = Date()
                    }
                )

                SanityCheckBanner(
                    isSanityChecking: isSanityChecking,
                    pendingSuggestions: pendingSuggestions,
                    sanityCheckError: sanityCheckError,
                    itemsChangedSinceCheck: itemsChangedSinceCheck,
                    onAccept: { onAcceptSuggestions?() },
                    onReject: { onRejectSuggestions?() },
                    onDismissError: { onDismissSanityError?() },
                    onRecategorize: { onRecategorize?() }
                )

                ForEach(grouped, id: \.section) { group in
                    GrocerySectionView(
                        sectionName: group.section,
                        items: group.items,
                        settlingItemIDs: settlingItems,
                        allSectionNames: allSectionNames(from: grouped),
                        onToggle: { toggleItem($0) },
                        onDelete: { deleteItem($0) },
                        onRename: { item, newName in renameItem(item, to: newName) },
                        onRecategorize: { item, newCat in recategorizeItem(item, to: newCat) }
                    )
                }

                AddItemButton { addItem() }
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if let onOpenHistory {
                    Button(action: onOpenHistory) {
                        Image(systemName: "clock.arrow.circlepath")
                    }
                }
                if let onOpenSettings {
                    Button(action: onOpenSettings) {
                        Image(systemName: "gearshape")
                    }
                }
                Button(action: onNewList) {
                    Label("New List", systemImage: "plus.rectangle")
                }
            }
        }
        .navigationTitle("AIsle List")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Grouping & Sorting

    private struct SectionGroup: Equatable {
        let section: String
        let items: [GroceryItem]

        static func == (lhs: SectionGroup, rhs: SectionGroup) -> Bool {
            lhs.section == rhs.section
        }
    }

    private func sortedSections(from items: [GroceryItem]) -> [SectionGroup] {
        // Group by category
        var groups: [String: [GroceryItem]] = [:]
        for item in items {
            groups[item.category, default: []].append(item)
        }

        // Within each section: unchecked (+ settling) first, then checked
        for (section, sectionItems) in groups {
            let unchecked = sectionItems.filter { !$0.isChecked || settlingItems.contains($0.id) }
            let checked = sectionItems.filter { $0.isChecked && !settlingItems.contains($0.id) }
            groups[section] = unchecked + checked
        }

        // Order: known (excl Other) -> dynamic (alpha) -> Other
        let known = StoreSections.sectionOrder.filter { s in
            s != "Other" && (groups[s]?.isEmpty == false)
        }
        let dynamic = groups.keys
            .filter { !StoreSections.sectionOrder.contains($0) }
            .sorted()
        let other: [String] = (groups["Other"]?.isEmpty == false) ? ["Other"] : []

        return (known + dynamic + other).map { SectionGroup(section: $0, items: groups[$0] ?? []) }
    }

    private func allSectionNames(from groups: [SectionGroup]) -> [String] {
        let present = Set(groups.map(\.section))
        var names = StoreSections.sectionOrder.filter { $0 != "Other" }
        for s in present where !names.contains(s) && s != "Other" {
            names.append(s)
        }
        names.append("Other")
        return names
    }

    // MARK: - Actions

    private func toggleItem(_ item: GroceryItem) {
        let itemId = item.id

        if !item.isChecked {
            // Checking: add to settling set, auto-remove after 800ms
            settlingItems.insert(itemId)
            let task = Task {
                try? await Task.sleep(for: .milliseconds(800))
                guard !Task.isCancelled else { return }
                withAnimation(.easeInOut(duration: 0.3)) {
                    settlingItems.remove(itemId)
                }
                settleTasks.removeValue(forKey: itemId)
            }
            settleTasks[itemId] = task
        } else {
            // Unchecking while settling: cancel the timer
            if settlingItems.contains(itemId) {
                settleTasks[itemId]?.cancel()
                settleTasks.removeValue(forKey: itemId)
                settlingItems.remove(itemId)
            }
        }

        withAnimation(.easeInOut(duration: 0.2)) {
            item.isChecked.toggle()
        }
        session.updatedAt = Date()
    }

    private func deleteItem(_ item: GroceryItem) {
        withAnimation {
            modelContext.delete(item)
        }
        session.updatedAt = Date()
    }

    private func renameItem(_ item: GroceryItem, to newName: String) {
        item.name = newName
        item.category = StoreSections.categorizeItem(newName)
        session.updatedAt = Date()
    }

    private func recategorizeItem(_ item: GroceryItem, to newCategory: String) {
        let reserved = ["__proto__", "constructor", "prototype"]
        guard !reserved.contains(newCategory) else { return }
        item.category = newCategory
        session.updatedAt = Date()
    }

    private func addItem() {
        let newItem = GroceryItem(
            name: "New item",
            category: "Other",
            sortOrder: session.items.count
        )
        newItem.session = session
        modelContext.insert(newItem)
        session.updatedAt = Date()
    }
}
