import SwiftUI

struct GroceryItemRow: View {
    let item: GroceryItem
    let sectionStyle: StoreSections.SectionStyle
    let allSectionNames: [String]
    let onToggle: () -> Void
    let onDelete: () -> Void
    let onRename: (String) -> Void
    let onRecategorize: (String) -> Void

    @State private var isEditing = false
    @State private var editValue = ""
    @State private var checkboxScale: CGFloat = 1.0
    @State private var showCustomSectionAlert = false
    @State private var customSectionName = ""
    @FocusState private var editFieldFocused: Bool

    var body: some View {
        HStack(spacing: 8) {
            // Checkbox with spring animation
            Button(action: handleToggle) {
                Image(systemName: item.isChecked ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(item.isChecked ? sectionStyle.text : Color(.systemGray3))
                    .scaleEffect(checkboxScale)
            }
            .buttonStyle(.plain)
            .frame(minWidth: 44, minHeight: 44)

            // Name: editable text field or display
            if isEditing {
                TextField("Item name", text: $editValue, onCommit: commitEdit)
                    .textFieldStyle(.roundedBorder)
                    .focused($editFieldFocused)
                    .onAppear {
                        editValue = item.name
                        editFieldFocused = true
                    }
            } else {
                HStack(spacing: 6) {
                    Text(item.name)
                        .strikethrough(item.isChecked)
                        .foregroundStyle(item.isChecked ? .secondary : .primary)

                    // Category badge (caption2 capsule)
                    Text(item.category)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color(.tertiarySystemFill))
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
                .fill(item.isChecked ? Color(.secondarySystemFill) : Color(.systemBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .strokeBorder(Color(.separator), lineWidth: 0.5)
        )
        .overlay(alignment: .leading) {
            // Left accent border
            sectionStyle.border
                .frame(width: 4)
                .clipShape(UnevenRoundedRectangle(topLeadingRadius: 8, bottomLeadingRadius: 8))
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash")
            }
        }
        .contextMenu {
            // All known + dynamic sections for recategorization
            Section("Move to section") {
                ForEach(allSectionNames, id: \.self) { section in
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

                Divider()

                Button {
                    customSectionName = ""
                    showCustomSectionAlert = true
                } label: {
                    Label("Custom section...", systemImage: "tag")
                }
            }
        }
        .alert("Custom Section", isPresented: $showCustomSectionAlert) {
            TextField("Section name", text: $customSectionName)
            Button("Cancel", role: .cancel) {}
            Button("Move") {
                let trimmed = customSectionName.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    onRecategorize(trimmed)
                }
            }
        } message: {
            Text("Enter a custom section name for this item.")
        }
    }

    // MARK: - Actions

    private func handleToggle() {
        withAnimation(.spring(response: 0.25, dampingFraction: 0.5)) {
            checkboxScale = 1.3
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            withAnimation(.spring(response: 0.25, dampingFraction: 0.6)) {
                checkboxScale = 1.0
            }
        }
        onToggle()
    }

    private func commitEdit() {
        let trimmed = editValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty && trimmed != item.name {
            onRename(trimmed)
        }
        isEditing = false
    }
}
