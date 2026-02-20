import SwiftUI
import SwiftData

struct ContentView: View {
    @State private var viewModel = AppViewModel()
    @Environment(\.modelContext) private var modelContext
    @State private var showHistory = false
    @State private var showSettings = false
    @AppStorage("prefersDarkMode") private var prefersDarkMode = false

    private let keychainKey = "anthropic_api_key"

    var body: some View {
        NavigationStack {
            Group {
                switch viewModel.currentRoute {
                case .apiKey:
                    ApiKeyInputView { apiKey in
                        if let data = apiKey.data(using: .utf8) {
                            _ = KeychainHelper.save(key: keychainKey, data: data)
                        }
                        viewModel.currentRoute = .upload
                    }

                case .upload:
                    ImageUploadView(
                        onImageSelected: { image in
                            Task {
                                guard let service = makeAnalysisService() else { return }
                                await viewModel.handleImageUpload(image, using: service)
                            }
                        },
                        onLoadSession: { session in
                            viewModel.loadSession(session)
                        },
                        onOpenHistory: { showHistory = true },
                        onOpenSettings: { showSettings = true },
                        isAnalyzing: viewModel.isAnalyzing
                    )

                case .clarify(let sections):
                    ClarifyView(
                        sections: sections,
                        onConfirm: { selected in
                            viewModel.handleConfirmSections(selected, modelContext: modelContext)
                            if let session = viewModel.currentSession {
                                Task {
                                    guard let service = makeAnalysisService() else { return }
                                    await viewModel.runSanityCheck(items: session.items, using: service)
                                }
                            }
                        },
                        onBack: {
                            viewModel.handleBackToUpload()
                        }
                    )

                case .list:
                    if let session = viewModel.currentSession {
                        GroceryListPlaceholder(
                            session: session,
                            viewModel: viewModel,
                            onOpenHistory: { showHistory = true },
                            onOpenSettings: { showSettings = true },
                            makeService: makeAnalysisService
                        )
                    }
                }
            }
            .animation(.default, value: viewModel.currentRoute)
        }
        .sheet(isPresented: $showHistory) {
            HistoryView { session in
                viewModel.loadSession(session)
                showHistory = false
            }
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
        .preferredColorScheme(prefersDarkMode ? .dark : .light)
        .onAppear {
            if KeychainHelper.load(key: keychainKey) != nil {
                viewModel.currentRoute = .upload
            }
        }
        .overlay {
            if let error = viewModel.analysisError {
                VStack {
                    Spacer()
                    Text(error)
                        .font(.subheadline)
                        .foregroundStyle(.red)
                        .padding()
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
                        .padding()
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .onTapGesture { viewModel.analysisError = nil }
            }
        }
    }

    private func makeAnalysisService() -> (any GroceryAnalysisService)? {
        guard let data = KeychainHelper.load(key: keychainKey),
              let apiKey = String(data: data, encoding: .utf8) else { return nil }
        return DirectAnthropicService(apiKey: apiKey)
    }
}

// MARK: - Temporary Placeholder (until GroceryListView is implemented in Task 1.10)

/// Temporary stand-in that will be replaced by the full GroceryListView.
private struct GroceryListPlaceholder: View {
    let session: ListSession
    let viewModel: AppViewModel
    let onOpenHistory: () -> Void
    let onOpenSettings: () -> Void
    let makeService: () -> (any GroceryAnalysisService)?

    private var groupedItems: [(String, [GroceryItem])] {
        let dict = Dictionary(grouping: session.items) { $0.category }
        return StoreSections.sectionOrder.compactMap { section in
            guard let items = dict[section], !items.isEmpty else { return nil }
            return (section, items.sorted { $0.sortOrder < $1.sortOrder })
        } + dict.keys
            .filter { !StoreSections.sectionOrder.contains($0) }
            .sorted()
            .compactMap { section in
                guard let items = dict[section], !items.isEmpty else { return nil }
                return (section, items.sorted { $0.sortOrder < $1.sortOrder })
            }
    }

    var body: some View {
        List {
            GroceryListHeader(session: session) { newName in
                session.name = newName
                session.updatedAt = Date()
            }
            .listRowSeparator(.hidden)

            if viewModel.isSanityChecking {
                HStack(spacing: 8) {
                    ProgressView()
                        .controlSize(.small)
                    Text("Refining categories...")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            if let suggestions = viewModel.pendingSuggestions {
                Section {
                    Text("AI suggests moving \(suggestions.count) item\(suggestions.count == 1 ? "" : "s") to better sections.")
                        .font(.subheadline)

                    HStack {
                        Button("Accept") { viewModel.acceptSuggestions() }
                            .buttonStyle(.borderedProminent)
                            .tint(.green)

                        Button("Dismiss") { viewModel.rejectSuggestions() }
                            .buttonStyle(.bordered)
                    }
                }
            }

            if let error = viewModel.sanityCheckError {
                Section {
                    HStack {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.orange)
                        Spacer()
                        Button("Retry") {
                            if let service = makeService() {
                                viewModel.recategorize(using: service)
                            }
                        }
                        .font(.caption)
                    }
                }
            }

            ForEach(groupedItems, id: \.0) { sectionName, items in
                GrocerySectionView(
                    sectionName: sectionName,
                    items: items,
                    onToggle: { item in item.isChecked.toggle() },
                    onDelete: { item in session.items.removeAll { $0.id == item.id } },
                    onRename: { item, newName in item.name = newName },
                    onRecategorize: { item, newCategory in item.category = newCategory }
                )
            }
        }
        .listStyle(.insetGrouped)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    viewModel.handleNewList()
                } label: {
                    Label("New List", systemImage: "plus")
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 16) {
                    if viewModel.itemsChangedSinceCheck {
                        Button {
                            if let service = makeService() {
                                viewModel.recategorize(using: service)
                            }
                        } label: {
                            Image(systemName: "arrow.triangle.2.circlepath")
                        }
                    }
                    Button(action: onOpenHistory) {
                        Image(systemName: "clock")
                    }
                    Button(action: onOpenSettings) {
                        Image(systemName: "gearshape")
                    }
                }
            }
        }
    }
}
