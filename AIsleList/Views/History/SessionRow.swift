import SwiftUI
import SwiftData

struct SessionRow: View {
    let session: ListSession

    private var progress: Double {
        guard session.itemCount > 0 else { return 0 }
        return Double(session.checkedCount) / Double(session.itemCount)
    }

    private var progressColor: Color {
        if progress >= 1.0 { return .green }
        if progress > 0.5 { return .blue }
        return .gray
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(session.name)
                    .font(.headline)

                Spacer()

                if session.hasImage {
                    Image(systemName: "photo")
                        .foregroundStyle(.secondary)
                        .font(.caption)
                }
            }

            Text(session.createdAt, format: .dateTime.weekday(.abbreviated).month(.abbreviated).day().hour().minute())
                .font(.subheadline)
                .foregroundStyle(.secondary)

            HStack(spacing: 8) {
                ProgressView(value: progress)
                    .tint(progressColor)

                Text("\(session.checkedCount)/\(session.itemCount)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
        }
        .padding(.vertical, 4)
    }
}
