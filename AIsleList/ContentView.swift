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
                        GroceryListView(
                            session: session,
                            onNewList: { viewModel.handleNewList() },
                            onOpenHistory: { showHistory = true },
                            onOpenSettings: { showSettings = true },
                            isSanityChecking: viewModel.isSanityChecking,
                            pendingSuggestions: viewModel.pendingSuggestions ?? [],
                            sanityCheckError: viewModel.sanityCheckError,
                            itemsChangedSinceCheck: viewModel.itemsChangedSinceCheck,
                            onAcceptSuggestions: { viewModel.acceptSuggestions() },
                            onRejectSuggestions: { viewModel.rejectSuggestions() },
                            onDismissSanityError: { viewModel.sanityCheckError = nil },
                            onRecategorize: {
                                if let service = makeAnalysisService() {
                                    viewModel.recategorize(using: service)
                                }
                            }
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

