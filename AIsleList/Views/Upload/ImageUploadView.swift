import SwiftUI
import PhotosUI
import SwiftData

struct ImageUploadView: View {
    var onImageSelected: (UIImage) -> Void
    var onLoadSession: (ListSession) -> Void
    var onOpenHistory: () -> Void
    var onOpenSettings: () -> Void
    var isAnalyzing: Bool

    @State private var showCamera = false
    @State private var capturedImage: UIImage?
    @State private var selectedItem: PhotosPickerItem?
    @State private var previewImage: UIImage?

    @Query(sort: \ListSession.createdAt, order: .reverse)
    private var recentSessions: [ListSession]

    private var displaySessions: [ListSession] {
        Array(recentSessions.prefix(3))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                headerSection

                if isAnalyzing {
                    loadingOverlay
                } else if let previewImage {
                    previewSection(previewImage)
                } else {
                    uploadSection

                    if !displaySessions.isEmpty {
                        recentSessionsSection
                    }
                }
            }
            .padding()
        }
        .navigationTitle("")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 16) {
                    Button(action: onOpenHistory) {
                        Image(systemName: "clock")
                    }
                    Button(action: onOpenSettings) {
                        Image(systemName: "gearshape")
                    }
                }
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker(image: $capturedImage)
                .ignoresSafeArea()
        }
        .onChange(of: capturedImage) { _, newImage in
            if let newImage {
                previewImage = newImage
                onImageSelected(newImage)
            }
        }
        .onChange(of: selectedItem) { _, newItem in
            Task {
                guard let data = try? await newItem?.loadTransferable(type: Data.self),
                      let uiImage = UIImage(data: data) else { return }
                previewImage = uiImage
                onImageSelected(uiImage)
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: 4) {
            Text("AIsle List")
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundStyle(.green)

            Text("Upload a photo of your handwritten list")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
    }

    // MARK: - Upload Area

    private var uploadSection: some View {
        VStack(spacing: 16) {
            Image(systemName: "photo.badge.plus")
                .font(.system(size: 48))
                .foregroundStyle(.green.opacity(0.6))

            Text("Take or choose a photo of your grocery list")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            HStack(spacing: 12) {
                Button {
                    showCamera = true
                } label: {
                    Label("Take Photo", systemImage: "camera.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)

                PhotosPicker(selection: $selectedItem, matching: .images) {
                    Label("Choose Photo", systemImage: "photo.on.rectangle")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.bordered)
                .tint(.green)
            }

            Text("AI reads your handwriting and organizes items by store section")
                .font(.caption)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .background {
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(style: StrokeStyle(lineWidth: 2, dash: [8, 6]))
                .foregroundStyle(.green.opacity(0.4))
        }
    }

    // MARK: - Loading Overlay

    private var loadingOverlay: some View {
        VStack(spacing: 16) {
            if let previewImage {
                Image(uiImage: previewImage)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 200)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .opacity(0.6)
            }

            ProgressView()
                .controlSize(.large)

            Text("Reading your grocery list...")
                .font(.headline)
                .foregroundStyle(.green)
        }
        .padding(32)
        .frame(maxWidth: .infinity)
        .background {
            RoundedRectangle(cornerRadius: 16)
                .fill(.ultraThinMaterial)
        }
    }

    // MARK: - Preview

    private func previewSection(_ image: UIImage) -> some View {
        VStack(spacing: 12) {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .frame(maxHeight: 300)
                .clipShape(RoundedRectangle(cornerRadius: 12))

            Button("Choose Different Photo") {
                previewImage = nil
                capturedImage = nil
                selectedItem = nil
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
    }

    // MARK: - Recent Sessions

    private var recentSessionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "clock")
                    .foregroundStyle(.blue)
                Text("Recent Lists")
                    .font(.headline)

                Spacer()

                Button("View All", action: onOpenHistory)
                    .font(.subheadline)
            }

            ForEach(displaySessions) { session in
                Button {
                    onLoadSession(session)
                } label: {
                    sessionCard(session)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .background {
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemGroupedBackground))
        }
    }

    private func sessionCard(_ session: ListSession) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(session.name)
                    .font(.body)
                    .fontWeight(.medium)
                    .foregroundStyle(.primary)
                    .lineLimit(1)

                Text(session.createdAt.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            HStack(spacing: 8) {
                progressBar(for: session)

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(12)
        .background {
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(.systemBackground))
        }
    }

    private func progressBar(for session: ListSession) -> some View {
        let total = session.itemCount
        let checked = session.checkedCount
        let progress = total > 0 ? Double(checked) / Double(total) : 0

        return HStack(spacing: 6) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color(.systemGray5))

                    Capsule()
                        .fill(progress >= 1.0 ? .green : progress > 0.5 ? .blue : .gray)
                        .frame(width: geo.size.width * progress)
                }
            }
            .frame(width: 48, height: 6)

            Text("\(Int(progress * 100))%")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .monospacedDigit()
                .frame(width: 30, alignment: .trailing)
        }
    }
}

#Preview {
    NavigationStack {
        ImageUploadView(
            onImageSelected: { _ in },
            onLoadSession: { _ in },
            onOpenHistory: {},
            onOpenSettings: {},
            isAnalyzing: false
        )
    }
    .modelContainer(for: ListSession.self, inMemory: true)
}
