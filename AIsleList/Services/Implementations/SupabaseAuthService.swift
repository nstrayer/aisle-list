import Foundation
import Observation
import Supabase

@Observable
final class SupabaseAuthService: AuthService {

    private(set) var authState: AuthState = .unknown

    private let client: SupabaseClient
    let baseURL: URL

    init?(urlString: String, anonKey: String) {
        guard let url = URL(string: urlString), !anonKey.isEmpty else {
            return nil
        }
        self.baseURL = url
        self.client = SupabaseClient(supabaseURL: url, supabaseKey: anonKey)
    }

    /// Current access token, fetched fresh from the session to avoid staleness.
    var accessToken: String? {
        // The Supabase SDK manages token refresh internally;
        // reading currentSession returns the latest valid token.
        try? client.auth.currentSession.accessToken
    }

    // MARK: - Sign In with Apple

    func signInWithApple(idToken: String, nonce: String) async throws {
        let session = try await client.auth.signInWithIdToken(
            credentials: .init(provider: .apple, idToken: idToken, nonce: nonce)
        )
        authState = .signedIn(userId: session.user.id.uuidString)
    }

    // MARK: - Restore Session

    func restoreSession() async {
        do {
            let session = try await client.auth.session
            authState = .signedIn(userId: session.user.id.uuidString)
        } catch {
            authState = .signedOut
        }
    }

    // MARK: - Sign Out

    func signOut() async throws {
        try await client.auth.signOut()
        authState = .signedOut
    }

    // MARK: - Supabase Client Access

    var functionsBaseURL: URL {
        baseURL.appendingPathComponent("functions/v1")
    }
}
