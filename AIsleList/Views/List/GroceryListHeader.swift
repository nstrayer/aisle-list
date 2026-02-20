import SwiftUI

struct GroceryListHeader: View {
    let sessionName: String
    let checkedCount: Int
    let totalCount: Int
    let thumbnailData: Data?
    let onRename: (String) -> Void

    @State private var isEditingName = false
    @State private var nameValue = ""

    private var progress: Double {
        guard totalCount > 0 else { return 0 }
        return Double(checkedCount) / Double(totalCount)
    }

    private var percentComplete: Int {
        Int((progress * 100).rounded())
    }

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            ProgressRing(progress: percentComplete)

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

            // Thumbnail of original list photo
            if let data = thumbnailData, let uiImage = UIImage(data: data) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 44, height: 44)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    private func saveName() {
        let trimmed = nameValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            onRename(trimmed)
        }
        isEditingName = false
    }
}

// MARK: - Progress Ring

private struct ProgressRing: View {
    let progress: Int
    var size: CGFloat = 64
    var strokeWidth: CGFloat = 6

    @State private var animatedProgress: CGFloat = 0
    @State private var celebrationScale: CGFloat = 1
    @State private var celebrationRotation: Double = 0

    private var isComplete: Bool { progress == 100 }

    private var ringColor: Color {
        if isComplete { return .green }
        if progress > 50 { return .blue }
        return Color(.systemGray3)
    }

    var body: some View {
        ZStack {
            // Background track
            Circle()
                .stroke(Color(.systemGray5), lineWidth: strokeWidth)

            // Progress arc
            Circle()
                .trim(from: 0, to: animatedProgress / 100)
                .stroke(ringColor, style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))

            // Percentage label
            Text("\(progress)%")
                .font(.system(.callout, design: .rounded, weight: .bold))
                .foregroundStyle(isComplete ? .green : .primary)
        }
        .frame(width: size, height: size)
        .scaleEffect(celebrationScale)
        .rotationEffect(.degrees(celebrationRotation))
        .onChange(of: progress) { oldValue, newValue in
            withAnimation(.easeInOut(duration: 0.4)) {
                animatedProgress = CGFloat(newValue)
            }
            if newValue == 100 && oldValue != 100 {
                celebrateCompletion()
            }
        }
        .onAppear {
            animatedProgress = CGFloat(progress)
        }
    }

    private func celebrateCompletion() {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.4)) {
            celebrationScale = 1.15
            celebrationRotation = 5
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
                celebrationScale = 1
                celebrationRotation = 0
            }
        }
    }
}
