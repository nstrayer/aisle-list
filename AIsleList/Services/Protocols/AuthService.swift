import Foundation

enum AuthState: Equatable {
    case unknown
    case signedOut
    case signedIn(userId: String)
}

protocol AuthService: Observable {
    var authState: AuthState { get }
    var accessToken: String? { get }

    func signInWithApple(idToken: String, nonce: String) async throws
    func restoreSession() async
    func signOut() async throws
}
