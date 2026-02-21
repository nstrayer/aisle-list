import Foundation
import Observation
import Supabase

@Observable
final class SupabaseAuthService: AuthService {

    private(set) var authState: AuthState = .unknown
    private(set) var accessToken: String?

    private let client: SupabaseClient
    let baseURL: URL
    let anonKey: String

    init?(urlString: String, anonKey: String) {
        guard let url = URL(string: urlString), !anonKey.isEmpty else {
            return nil
        }
        self.baseURL = url
        self.anonKey = anonKey
        self.client = SupabaseClient(supabaseURL: url, supabaseKey: anonKey)
    }

    // MARK: - Sign In with Apple

    func signInWithApple(idToken: String, nonce: String) async throws {
        let session = try await client.auth.signInWithIdToken(
            credentials: .init(provider: .apple, idToken: idToken, nonce: nonce)
        )
        accessToken = session.accessToken
        authState = .signedIn(userId: session.user.id.uuidString)
    }

    // MARK: - Restore Session

    func restoreSession() async {
        do {
            let session = try await client.auth.session
            accessToken = session.accessToken
            authState = .signedIn(userId: session.user.id.uuidString)
        } catch {
            authState = .signedOut
            accessToken = nil
        }
    }

    // MARK: - Sign Out

    func signOut() async throws {
        try await client.auth.signOut()
        authState = .signedOut
        accessToken = nil
    }

    // MARK: - Supabase Client Access

    var functionsBaseURL: URL {
        baseURL.appendingPathComponent("functions/v1")
    }
}
