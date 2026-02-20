import SwiftUI

struct ApiKeyInputView: View {
    var onSave: (String) -> Void

    @State private var apiKey = ""

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Text("AIsle List")
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundStyle(.green)

            Text("Snap a photo of your handwritten grocery list and let AI organize it by store section.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            VStack(spacing: 12) {
                SecureField("Anthropic API Key", text: $apiKey)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.password)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .padding(.horizontal, 32)

                Button {
                    onSave(apiKey.trimmingCharacters(in: .whitespacesAndNewlines))
                } label: {
                    Text("Save & Continue")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .disabled(apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .padding(.horizontal, 32)
            }

            Link("Get an API key",
                 destination: URL(string: "https://console.anthropic.com/")!)
                .font(.caption)
                .foregroundStyle(.secondary)

            Spacer()
        }
    }
}

#Preview {
    ApiKeyInputView { key in
        print("Saved key: \(key)")
    }
}
