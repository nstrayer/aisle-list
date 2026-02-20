import SwiftUI

struct GroceryItemRow: View {
    @Bindable var item: GroceryItem
    let sectionStyle: StoreSections.SectionStyle
    let onToggle: () -> Void
    let onDelete: () -> Void
    let onRename: (String) -> Void
    let onRecategorize: (String) -> Void

    @State private var isEditing = false
    @State private var editText = ""
    @State private var showCategoryPicker = false

    var body: some View {
        HStack(spacing: 12) {
            Button(action: onToggle) {
                Image(systemName: item.isChecked ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(item.isChecked ? .green : .secondary)
                    .contentTransition(.symbolEffect(.replace))
            }
            .buttonStyle(.plain)

            if isEditing {
                TextField("Item name", text: $editText)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { saveEdit() }
            } else {
                Text(item.name)
                    .strikethrough(item.isChecked)
                    .foregroundStyle(item.isChecked ? .secondary : .primary)
                    .onTapGesture {
                        editText = item.name
                        isEditing = true
                    }

                Spacer()

                Text(item.category)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color(.tertiarySystemFill))
                    .clipShape(Capsule())
            }
        }
        .padding(.vertical, 2)
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash")
            }
        }
        .swipeActions(edge: .leading) {
            Button {
                showCategoryPicker = true
            } label: {
                Label("Move", systemImage: "arrow.right.arrow.left")
            }
            .tint(.orange)
        }
        .confirmationDialog("Move to Section", isPresented: $showCategoryPicker) {
            ForEach(StoreSections.sectionOrder, id: \.self) { section in
                Button(section) {
                    onRecategorize(section)
                }
            }
            Button("Cancel", role: .cancel) {}
        }
    }

    private func saveEdit() {
        let trimmed = editText.trimmingCharacters(in: .whitespaces)
        if !trimmed.isEmpty {
            onRename(trimmed)
        }
        isEditing = false
    }
}
