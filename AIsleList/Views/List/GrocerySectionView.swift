import SwiftUI

struct GrocerySectionView: View {
    let sectionName: String
    let items: [GroceryItem]
    let onToggle: (GroceryItem) -> Void
    let onDelete: (GroceryItem) -> Void
    let onRename: (GroceryItem, String) -> Void
    let onRecategorize: (GroceryItem, String) -> Void

    private var style: StoreSections.SectionStyle {
        StoreSections.getSectionStyle(sectionName)
    }

    var body: some View {
        Section {
            ForEach(items) { item in
                GroceryItemRow(
                    item: item,
                    sectionStyle: style,
                    onToggle: { onToggle(item) },
                    onDelete: { onDelete(item) },
                    onRename: { onRename(item, $0) },
                    onRecategorize: { onRecategorize(item, $0) }
                )
            }
        } header: {
            HStack(spacing: 8) {
                Text(sectionName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(style.text)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(style.background)
                    .clipShape(Capsule())

                Spacer()

                Text("\(items.count)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
