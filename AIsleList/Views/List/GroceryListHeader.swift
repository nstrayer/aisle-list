import SwiftUI

struct GroceryListHeader: View {
    let checkedCount: Int
    let totalCount: Int
    @Binding var sessionName: String
    let onRename: (String) -> Void

    @State private var isEditingName = false
    @State private var nameValue = ""
    @State private var isCelebrating = false

    private var progress: Double {
        guard totalCount > 0 else { return 0 }
        return Double(checkedCount) / Double(totalCount)
    }

    private var percentComplete: Int {
        Int((progress * 100).rounded())
    }

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            // Progress ring
            progressRing

            VStack(alignment: .leading, spacing: 4) {
                // Editable session name
                if isEditingName {
                    TextField("List name", text: $nameValue, onCommit: saveName)
                        .font(.title2.bold())
                        .textFieldStyle(.roundedBorder)
                        .onAppear { nameValue = sessionName }
                } else {
                    Text(sessionName.isEmpty ? "Your Shopping List" : sessionName)
                        .font(.title2.bold())
                        .onTapGesture {
                            nameValue = sessionName.isEmpty ? "Your Shopping List" : sessionName
                            isEditingName = true
                        }
                }

                // Subtitle
                Text(percentComplete == 100
                     ? "All done! Great shopping!"
                     : "\(checkedCount) of \(totalCount) items checked")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
    }

    // MARK: - Progress Ring

    private var progressRing: some View {
        let size: CGFloat = 64
        let lineWidth: CGFloat = 6

        return ZStack {
            // Background track
            Circle()
                .stroke(Color(.systemGray5), lineWidth: lineWidth)

            // Progress arc
            Circle()
                .trim(from: 0, to: progress)
                .stroke(progressColor, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.4), value: progress)

            // Percentage text
            Text("\(percentComplete)%")
                .font(.system(.callout, design: .rounded, weight: .bold))
                .foregroundStyle(percentComplete == 100 ? Color.green : Color.primary)
        }
        .frame(width: size, height: size)
        .scaleEffect(isCelebrating ? 1.15 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.5), value: isCelebrating)
        .onChange(of: percentComplete) { _, newValue in
            if newValue == 100 {
                isCelebrating = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    isCelebrating = false
                }
            }
        }
    }

    private var progressColor: Color {
        if percentComplete == 100 { return .green }
        if percentComplete > 50 { return .blue }
        return Color(.systemGray3)
    }

    private func saveName() {
        let trimmed = nameValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            onRename(trimmed)
        }
        isEditingName = false
    }
}
