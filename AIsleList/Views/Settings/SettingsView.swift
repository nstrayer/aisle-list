import SwiftUI

struct SettingsView: View {
    @AppStorage("prefersDarkMode") private var prefersDarkMode = false
    @State private var maskedKey: String = ""
    @State private var showChangeKey = false
    @State private var newKey = ""
    @Environment(\.dismiss) private var dismiss
    @Environment(\.authService) private var authService

    private let keychainKey = "anthropic_api_key"

    private var isAuthMode: Bool { authService != nil }

    var body: some View {
        NavigationStack {
            Form {
                Section("Appearance") {
                    Toggle("Dark Mode", isOn: $prefersDarkMode)
                }

                if isAuthMode {
                    accountSection
                } else {
                    apiKeySection
                }

                Section("About") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .alert("Change API Key", isPresented: $showChangeKey) {
                SecureField("New API Key", text: $newKey)
                Button("Save") {
                    let trimmed = newKey.trimmingCharacters(in: .whitespacesAndNewlines)
                    if let data = trimmed.data(using: .utf8), !trimmed.isEmpty {
                        if KeychainHelper.save(key: keychainKey, data: data) {
                            maskedKey = maskKey(trimmed)
                        }
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
            .onAppear {
                if !isAuthMode {
                    loadMaskedKey()
                }
            }
        }
    }

    // MARK: - Account Section (Supabase auth mode)

    @ViewBuilder
    private var accountSection: some View {
        Section("Account") {
            if let auth = authService as? SupabaseAuthService,
               case .signedIn(let userId) = auth.authState {
                HStack {
                    Text("Signed in")
                    Spacer()
                    Text(String(userId.prefix(8)) + "...")
                        .foregroundStyle(.secondary)
                        .font(.caption)
                }
            }

            Button("Sign Out", role: .destructive) {
                Task {
                    try? await authService?.signOut()
                    dismiss()
                }
            }
        }
    }

    // MARK: - API Key Section (BYOK mode)

    @ViewBuilder
    private var apiKeySection: some View {
        Section("API Key") {
            if maskedKey.isEmpty {
                Text("No API key saved")
                    .foregroundStyle(.secondary)
            } else {
                Text(maskedKey)
                    .font(.system(.body, design: .monospaced))
            }

            Button("Change Key") {
                newKey = ""
                showChangeKey = true
            }

            Button("Remove Key", role: .destructive) {
                KeychainHelper.delete(key: keychainKey)
                maskedKey = ""
            }
        }
    }

    // MARK: - Helpers

    private func loadMaskedKey() {
        guard let data = KeychainHelper.load(key: keychainKey),
              let key = String(data: data, encoding: .utf8),
              !key.isEmpty else {
            maskedKey = ""
            return
        }
        maskedKey = maskKey(key)
    }

    private func maskKey(_ key: String) -> String {
        guard key.count > 8 else { return String(repeating: "*", count: key.count) }
        let prefix = String(key.prefix(4))
        let suffix = String(key.suffix(4))
        return "\(prefix)...\(suffix)"
    }
}
