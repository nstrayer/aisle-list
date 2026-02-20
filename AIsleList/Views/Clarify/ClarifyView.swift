import SwiftUI

struct ClarifyView: View {
    let sections: [GrocerySection]
    let onConfirm: ([GrocerySection]) -> Void
    let onBack: () -> Void

    @State private var selected: Set<UUID>

    init(sections: [GrocerySection], onConfirm: @escaping ([GrocerySection]) -> Void, onBack: @escaping () -> Void) {
        self.sections = sections
        self.onConfirm = onConfirm
        self.onBack = onBack
        // Default: select all except crossed_out
        _selected = State(initialValue: Set(sections.filter { $0.type != .crossedOut }.map(\.id)))
    }

    private var selectedCount: Int { selected.count }

    var body: some View {
        List {
            Section {
                Text("We found \(sections.count) section\(sections.count == 1 ? "" : "s") in your list. Choose which ones to include.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Section {
                ForEach(sections) { section in
                    SectionCard(
                        section: section,
                        isSelected: selected.contains(section.id),
                        onToggle: { toggle(section.id) }
                    )
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Review Sections")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Re-upload", action: onBack)
            }
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 8) {
                Text("\(selectedCount) of \(sections.count) sections selected")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                Button(action: confirmSelection) {
                    Text("Add Selected to List")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .disabled(selectedCount == 0)
            }
            .padding()
            .background(.ultraThinMaterial)
        }
    }

    private func toggle(_ id: UUID) {
        if selected.contains(id) {
            selected.remove(id)
        } else {
            selected.insert(id)
        }
    }

    private func confirmSelection() {
        let selectedSections = sections.filter { selected.contains($0.id) }
        onConfirm(selectedSections)
    }
}
