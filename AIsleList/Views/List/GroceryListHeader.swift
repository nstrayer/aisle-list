import SwiftUI

struct GroceryListHeader: View {
    let session: ListSession
    let onRename: (String) -> Void

    @State private var isEditing = false
    @State private var nameText = ""

    private var progress: Double {
        guard session.itemCount > 0 else { return 0 }
        return Double(session.checkedCount) / Double(session.itemCount)
    }

    private var isComplete: Bool { progress >= 1.0 }

    var body: some View {
        HStack(spacing: 16) {
            progressRing

            VStack(alignment: .leading, spacing: 4) {
                if isEditing {
                    TextField("List name", text: $nameText)
                        .font(.title3.bold())
                        .textFieldStyle(.roundedBorder)
                        .onSubmit { saveName() }
                } else {
                    Text(session.name)
                        .font(.title3.bold())
                        .onTapGesture {
                            nameText = session.name
                            isEditing = true
                        }
                }

                Text(subtitleText)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
        .padding(.vertical, 8)
    }

    private var subtitleText: String {
        if isComplete {
            return "All done! Great shopping!"
        }
        return "\(session.checkedCount) of \(session.itemCount) items checked"
    }

    private var progressRing: some View {
        ZStack {
            Circle()
                .stroke(Color(.systemGray5), lineWidth: 6)

            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    isComplete ? Color.green : progress > 0.5 ? Color.blue : Color.gray,
                    style: StrokeStyle(lineWidth: 6, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.spring(duration: 0.4), value: progress)

            Text("\(Int(progress * 100))%")
                .font(.caption.bold())
                .monospacedDigit()
                .foregroundStyle(isComplete ? .green : .primary)
        }
        .frame(width: 56, height: 56)
    }

    private func saveName() {
        let trimmed = nameText.trimmingCharacters(in: .whitespaces)
        if !trimmed.isEmpty {
            onRename(trimmed)
        }
        isEditing = false
    }
}
