import SwiftUI

struct SectionCard: View {
    let section: GrocerySection
    let isSelected: Bool
    let onToggle: () -> Void

    private var badgeColor: Color {
        switch section.type {
        case .grocery: .green
        case .mealPlan: .purple
        case .crossedOut: .gray
        case .notes: .yellow
        }
    }

    private var badgeLabel: String {
        switch section.type {
        case .grocery: "Grocery"
        case .mealPlan: "Meal Plan"
        case .crossedOut: "Crossed Out"
        case .notes: "Notes"
        }
    }

    var body: some View {
        Button(action: onToggle) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(isSelected ? .green : .secondary)
                        .font(.title3)

                    Text(section.name)
                        .font(.headline)

                    Text(badgeLabel)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(badgeColor.opacity(0.15))
                        .foregroundStyle(badgeColor)
                        .clipShape(Capsule())

                    Spacer()

                    Text("\(section.items.count) item\(section.items.count == 1 ? "" : "s")")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                let preview = section.items.prefix(5).joined(separator: ", ")
                let remaining = section.items.count - 5
                HStack(spacing: 0) {
                    Text(preview)
                        .foregroundStyle(.secondary)
                    if remaining > 0 {
                        Text(" and \(remaining) more...")
                            .foregroundStyle(.tertiary)
                    }
                }
                .font(.subheadline)
                .padding(.leading, 32)
            }
            .padding()
            .background(isSelected ? Color.green.opacity(0.08) : Color(.secondarySystemGroupedBackground))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? Color.green : Color.clear, lineWidth: 2)
            )
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .opacity(isSelected ? 1 : 0.6)
        }
        .buttonStyle(.plain)
    }
}
