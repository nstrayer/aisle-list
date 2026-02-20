import SwiftUI

struct SanityCheckBanner: View {
    enum State {
        case checking
        case error(String, onDismiss: () -> Void, onRetry: (() -> Void)?)
        case suggestions([CategorySuggestion], onAccept: () -> Void, onDismiss: () -> Void)
    }

    let state: State

    @SwiftUI.State private var isExpanded = false

    var body: some View {
        switch state {
        case .checking:
            HStack(spacing: 8) {
                ProgressView()
                    .controlSize(.small)
                Text("Refining categories...")
                    .font(.subheadline)
            }
            .foregroundStyle(.blue)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.blue.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 10))

        case .error(let message, let onDismiss, let onRetry):
            HStack {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(.red)
                Spacer()
                if let onRetry {
                    Button("Retry", action: onRetry)
                        .font(.subheadline.bold())
                        .foregroundStyle(.red)
                }
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.caption)
                }
                .foregroundStyle(.red)
            }
            .padding(12)
            .background(Color.red.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 10))

        case .suggestions(let suggestions, let onAccept, let onDismiss):
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Button {
                        withAnimation { isExpanded.toggle() }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.right")
                                .rotationEffect(.degrees(isExpanded ? 90 : 0))
                                .font(.caption)
                            Text("AI suggests \(suggestions.count) category change\(suggestions.count == 1 ? "" : "s")")
                                .font(.subheadline.weight(.medium))
                        }
                    }
                    .buttonStyle(.plain)

                    Spacer()

                    Button("Accept", action: onAccept)
                        .font(.caption.bold())
                        .buttonStyle(.borderedProminent)
                        .tint(.orange)
                        .controlSize(.small)

                    Button("Dismiss", action: onDismiss)
                        .font(.caption)
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                }

                if isExpanded {
                    ForEach(suggestions) { suggestion in
                        HStack(spacing: 4) {
                            Text(suggestion.name)
                                .fontWeight(.medium)
                            Text(suggestion.from)
                                .foregroundStyle(.orange)
                            Image(systemName: "arrow.right")
                                .font(.caption2)
                            Text(suggestion.to)
                                .fontWeight(.medium)
                        }
                        .font(.caption)
                    }
                }
            }
            .foregroundStyle(.orange)
            .padding(12)
            .background(Color.orange.opacity(0.08))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.orange.opacity(0.3))
            )
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }
}
