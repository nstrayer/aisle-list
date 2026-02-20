import SwiftUI

struct GroceryItemRow: View {
    let item: GroceryItem
    let sectionStyle: StoreSections.SectionStyle
    let onToggle: () -> Void
    let onDelete: () -> Void
    let onRename: (String) -> Void
    let onRecategorize: (String) -> Void

    @State private var isEditing = false
    @State private var editValue = ""
    @State private var checkboxScale: CGFloat = 1.0

    var body: some View {
        HStack(spacing: 8) {
            // Checkbox
            Button(action: {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
                    checkboxScale = 1.3
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                        checkboxScale = 1.0
                    }
                }
                onToggle()
            }) {
                Image(systemName: item.isChecked ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(item.isChecked ? sectionStyle.text : Color(.systemGray3))
                    .scaleEffect(checkboxScale)
            }
            .buttonStyle(.plain)
            .frame(minWidth: 44, minHeight: 44)

            // Name (editable) or text field
            if isEditing {
                TextField("Item name", text: $editValue, onCommit: saveEdit)
                    .textFieldStyle(.roundedBorder)
                    .onAppear { editValue = item.name }
            } else {
                HStack(spacing: 6) {
                    Text(item.name)
                        .strikethrough(item.isChecked)
                        .foregroundStyle(item.isChecked ? .secondary : .primary)

                    // Category badge
                    Text(item.category)
                        .font(.system(size: 10))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color(.systemGray6))
                        .foregroundStyle(.secondary)
                        .clipShape(Capsule())
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
                .onTapGesture {
                    editValue = item.name
                    isEditing = true
                }
            }
        }
        .padding(.vertical, 4)
        .padding(.horizontal, 8)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(item.isChecked ? Color(.systemGray6) : Color(.systemBackground))
        )
        .overlay(
            // Left accent border
            HStack {
                RoundedRectangle(cornerRadius: 2)
                    .fill(sectionStyle.border)
                    .frame(width: 4)
                Spacer()
            }
        )
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash")
            }
        }
        .contextMenu {
            // Recategorize via context menu
            Menu("Move to Section") {
                ForEach(StoreSections.sectionOrder, id: \.self) { section in
                    Button {
                        onRecategorize(section)
                    } label: {
                        if section == item.category {
                            Label(section, systemImage: "checkmark")
                        } else {
                            Text(section)
                        }
                    }
                }
            }
        }
    }

    private func saveEdit() {
        let trimmed = editValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty && trimmed != item.name {
            onRename(trimmed)
        }
        isEditing = false
    }
}
