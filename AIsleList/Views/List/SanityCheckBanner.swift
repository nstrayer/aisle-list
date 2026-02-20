import SwiftUI

struct SanityCheckBanner: View {
    let isSanityChecking: Bool
    let pendingSuggestions: [CategorySuggestion]
    let sanityCheckError: String?
    let itemsChangedSinceCheck: Bool
    let onAccept: () -> Void
    let onReject: () -> Void
    let onDismissError: () -> Void
    let onRecategorize: () -> Void

    @State private var isExpanded = false

    var body: some View {
        VStack(spacing: 8) {
            // Spinner while checking
            if isSanityChecking {
                HStack(spacing: 8) {
                    ProgressView()
                        .controlSize(.small)
                    Text("Refining categories...")
                        .font(.subheadline)
                        .foregroundStyle(.blue)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Color.blue.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }

            // Error banner with dismiss + re-categorize retry
            if let error = sanityCheckError {
                HStack {
                    Text(error)
                        .font(.subheadline)
                        .foregroundStyle(.red)
                    Spacer()
                    Button(action: onDismissError) {
                        Image(systemName: "xmark")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
                .padding(12)
                .background(Color.red.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }

            // Pending suggestions with expandable list
            if !pendingSuggestions.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                isExpanded.toggle()
                            }
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "chevron.right")
                                    .font(.caption2.bold())
                                    .rotationEffect(.degrees(isExpanded ? 90 : 0))
                                Text("AI suggests \(pendingSuggestions.count) category change\(pendingSuggestions.count == 1 ? "" : "s")")
                                    .font(.subheadline.weight(.medium))
                            }
                            .foregroundStyle(.orange)
                        }
                        .buttonStyle(.plain)

                        Spacer()

                        HStack(spacing: 8) {
                            Button("Accept", action: onAccept)
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.orange)
                                .foregroundStyle(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 6))

                            Button("Dismiss", action: onReject)
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color(.tertiarySystemFill))
                                .foregroundStyle(.secondary)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(12)

                    if isExpanded {
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(pendingSuggestions) { suggestion in
                                HStack(spacing: 4) {
                                    Text(suggestion.name + ":")
                                        .fontWeight(.medium)
                                    Text(suggestion.from)
                                        .foregroundStyle(.orange.opacity(0.8))
                                    Image(systemName: "arrow.right")
                                        .font(.caption2)
                                        .foregroundStyle(.orange.opacity(0.6))
                                    Text(suggestion.to)
                                        .fontWeight(.medium)
                                }
                                .font(.caption)
                                .foregroundStyle(.orange)
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.bottom, 12)
                    }
                }
                .background(Color.orange.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.orange.opacity(0.3), lineWidth: 1)
                )
            }

            // Re-categorize button when items changed since last check or previous check failed
            if (itemsChangedSinceCheck || sanityCheckError != nil) && !isSanityChecking {
                Button(action: onRecategorize) {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .font(.subheadline)
                        Text("Re-categorize items with AI")
                            .font(.subheadline)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(10)
                    .background(Color.blue.opacity(0.08))
                    .foregroundStyle(.blue)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.blue.opacity(0.3), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }
}
