import SwiftUI

struct AddItemButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: "plus")
                    .font(.body)
                Text("Add item")
                    .font(.body)
            }
            .frame(maxWidth: .infinity)
            .padding(14)
            .foregroundStyle(.secondary)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(style: StrokeStyle(lineWidth: 2, dash: [8, 4]))
                    .foregroundStyle(Color(.systemGray4))
            )
        }
        .buttonStyle(.plain)
    }
}
