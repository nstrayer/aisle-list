import Foundation
import Observation
import Supabase

@Observable
final class SupabaseAuthService: AuthService {

    private(set) var authState: AuthState = .unknown
    private(set) var accessToken: String?

    private let client: SupabaseClient

    init() {
        guard let urlString = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
              let url = URL(string: urlString),
              let anonKey = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String else {
            fatalError("Missing SUPABASE_URL or SUPABASE_ANON_KEY in Info.plist")
        }
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

    var supabaseClient: SupabaseClient { client }
}
