import SwiftUI

struct GrocerySectionView: View {
    let sectionName: String
    let items: [GroceryItem]
    let settlingItemIDs: Set<String>
    let allSectionNames: [String]
    let onToggle: (GroceryItem) -> Void
    let onDelete: (GroceryItem) -> Void
    let onRename: (GroceryItem, String) -> Void
    let onRecategorize: (GroceryItem, String) -> Void

    private var style: StoreSections.SectionStyle {
        StoreSections.getSectionStyle(sectionName)
    }

    /// Items sorted: unchecked (and settling) first, then checked.
    private var sortedItems: [GroceryItem] {
        let unchecked = items.filter { !$0.isChecked || settlingItemIDs.contains($0.id) }
        let checked = items.filter { $0.isChecked && !settlingItemIDs.contains($0.id) }
        return unchecked + checked
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Section header with colored background
            HStack(spacing: 8) {
                Text(sectionName)
                    .font(.headline)
                    .foregroundStyle(style.text)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(style.background)
                    .clipShape(Capsule())

                // Item count badge
                Text("\(items.count)")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(style.text)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(style.background)
                    .clipShape(Capsule())

                Spacer()
            }

            Divider()
                .overlay(style.border)

            // Items
            ForEach(sortedItems, id: \.id) { item in
                GroceryItemRow(
                    item: item,
                    sectionStyle: style,
                    allSectionNames: allSectionNames,
                    onToggle: { onToggle(item) },
                    onDelete: { onDelete(item) },
                    onRename: { newName in onRename(item, newName) },
                    onRecategorize: { newCat in onRecategorize(item, newCat) }
                )
            }
        }
        .padding(.bottom, 12)
    }
}
